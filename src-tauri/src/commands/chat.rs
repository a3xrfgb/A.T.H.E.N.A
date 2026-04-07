use crate::db::{self, Db};
use crate::inference::engine::{ChatMsg, InferenceEngine};
use crate::models::{manager, mmproj};
use crate::state::{InferenceHandle, StreamCancel};
use crate::types::{AppSettings, Message, Thread};
use base64::Engine;
use chrono::{Local, Utc};
use rusqlite::params;
use image::ImageFormat;
use serde_json::json;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Instant;
use tauri::{Emitter, State, Window};
use uuid::Uuid;

/// User rows may store JSON v1 `{ "v":1, "text":"...", "image":"data:image/..." }` for vision,
/// or v2 `{ "v":2, "text":"...", "image"?: "...", "attachments":[{ "name","mime","dataBase64","extractedText"? }] }`.
fn user_content_for_database(text: &str, image: Option<&str>) -> String {
    let t = text.trim_start();
    if t.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(2) {
                return text.to_string();
            }
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) {
                return text.to_string();
            }
        }
    }
    let img = image.filter(|s| !s.trim().is_empty());
    match (text.trim().is_empty(), img) {
        (_, None) => text.to_string(),
        (true, Some(url)) => json!({ "v": 1, "text": "", "image": url }).to_string(),
        (false, Some(url)) => json!({ "v": 1, "text": text.trim(), "image": url }).to_string(),
    }
}

/// Assistant rows may store JSON `{ "v":1, "final": "..." }`; the model must receive `final` only.
/// User vision rows: return caption text only (image is sent via the current request or omitted in history).
fn api_text_for_stored_message(role: &str, content: &str) -> String {
    if role == "assistant" {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(content) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) {
                if let Some(f) = v.get("final").and_then(|x| x.as_str()) {
                    return f.to_string();
                }
            }
        }
        return content.to_string();
    }
    if role == "user" {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(content) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(2) {
                return user_display_caption_v2(&v);
            }
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) && v.get("image").is_some() {
                return v.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string();
            }
        }
        return content.to_string();
    }
    content.to_string()
}

fn user_display_caption_v2(v: &serde_json::Value) -> String {
    v.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// Default thread title — must match `create_thread` / frontend `createThread` default.
const DEFAULT_THREAD_TITLE: &str = "New chat";

fn truncate_for_title_prompt(s: &str, max_chars: usize) -> String {
    let t = s.trim();
    if t.is_empty() {
        return String::new();
    }
    let count = t.chars().count();
    if count <= max_chars {
        return t.to_string();
    }
    t.chars().take(max_chars).collect::<String>() + "…"
}

/// First user message + first assistant reply (chronological), for title generation.
fn first_exchange_for_title(rows: &[(String, String)]) -> Option<(String, String)> {
    let mut first_user: Option<String> = None;
    for (role, raw) in rows {
        if role == "user" {
            if first_user.is_none() {
                first_user = Some(api_text_for_stored_message("user", raw));
            }
        } else if role == "assistant" {
            if let Some(ref u) = first_user {
                let a = api_text_for_stored_message("assistant", raw);
                return Some((u.clone(), a));
            }
        }
    }
    None
}

fn sanitize_generated_title(raw: &str) -> Option<String> {
    let mut s = raw.trim();
    for prefix in ["Title:", "title:", "Title：", "标题："] {
        if let Some(rest) = s.strip_prefix(prefix) {
            s = rest.trim();
            break;
        }
    }
    let line = s.lines().next().unwrap_or("").trim();
    let mut t = line.replace(['\r', '\n'], " ");
    while t.contains("  ") {
        t = t.replace("  ", " ");
    }
    let t = t.trim_matches(|c| {
        matches!(
            c,
            '"' | '\'' | '「' | '」' | '«' | '»' | '“' | '”' | '‘' | '’'
        )
    });
    let t = t.trim();
    if t.is_empty() {
        return None;
    }
    if t.eq_ignore_ascii_case(DEFAULT_THREAD_TITLE) {
        return None;
    }
    const MAX: usize = 80;
    Some(if t.chars().count() > MAX {
        t.chars().take(MAX).collect::<String>() + "…"
    } else {
        t.to_string()
    })
}

fn parse_title_from_completion_blob(blob: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(blob).ok()?;
    let final_text = v.get("final").and_then(|x| x.as_str())?;
    sanitize_generated_title(final_text)
}

/// After the first complete user+assistant exchange, rename threads still titled `New chat`.
/// Errors are ignored so chat delivery never depends on title generation.
async fn maybe_auto_title_thread(
    db: &Db,
    inference: &InferenceHandle,
    base: &str,
    thread_id: &str,
) {
    let rows: Vec<(String, String)> = {
        let conn = match db.0.lock() {
            Ok(c) => c,
            Err(_) => return,
        };
        let title: String = match conn.query_row(
            "SELECT title FROM threads WHERE id = ?1",
            [thread_id],
            |r| r.get(0),
        ) {
            Ok(t) => t,
            Err(_) => return,
        };
        if title.trim() != DEFAULT_THREAD_TITLE {
            return;
        }
        let mut stmt = match conn.prepare(
            "SELECT role, content FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC, rowid ASC",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };
        let iter = match stmt.query_map([thread_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        }) {
            Ok(i) => i,
            Err(_) => return,
        };
        let mut out = Vec::new();
        for row in iter {
            if let Ok(r) = row {
                out.push(r);
            }
        }
        out
    };

    let Some((user_ex, asst_ex)) = first_exchange_for_title(&rows) else {
        return;
    };
    if asst_ex.trim().is_empty() {
        return;
    }

    let u = truncate_for_title_prompt(&user_ex, 1200);
    let a = truncate_for_title_prompt(&asst_ex, 1200);
    let msgs = vec![
        ChatMsg {
            role: "system".into(),
            content: "You output only a short chat title. At most 6 words. No quotation marks. No trailing punctuation. No prefix like \"Title:\". Use the same language as the user's message.".into(),
        },
        ChatMsg {
            role: "user".into(),
            content: format!(
                "Suggest a concise conversation title (a short phrase, not a sentence).\n\nUser:\n{}\n\nAssistant:\n{}",
                u, a
            ),
        },
    ];

    let blob = match inference
        .0
        .chat_complete(base, msgs, 0.25, 64, json!({ "enable_thinking": false }))
        .await
    {
        Ok(b) => b,
        Err(_) => return,
    };

    let Some(title) = parse_title_from_completion_blob(&blob) else {
        return;
    };

    let now = Utc::now().timestamp();
    let conn = match db.0.lock() {
        Ok(c) => c,
        Err(_) => return,
    };
    let _ = conn.execute(
        "UPDATE threads SET title = ?1, updated_at = ?2 WHERE id = ?3 AND TRIM(title) = ?4",
        params![title, now, thread_id, DEFAULT_THREAD_TITLE],
    );
}

/// True when `content` is JSON v1/v2 with a non-empty `image` field (composer vision attachment).
fn user_json_has_image(content: &str) -> bool {
    let t = content.trim_start();
    if !t.starts_with('{') {
        return false;
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(content) else {
        return false;
    };
    let vnum = v.get("v").and_then(|x| x.as_u64());
    if vnum != Some(1) && vnum != Some(2) {
        return false;
    }
    v.get("image")
        .and_then(|x| x.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
}

/// Strip `;codecs=` / `;charset=` etc. Browsers often send `audio/mpeg; codecs=mp3`, which breaks
/// llama-server data-URL parsing (invalid url format / truncated at `data:audio/mpeg;base64`).
fn mime_type_only(mime: &str) -> &str {
    mime.split(';').next().unwrap_or(mime).trim()
}

/// Lowercase + canonical MIME for `data:...;base64,...` URLs (llama-server rejects e.g. `audio/MPEG`).
fn normalize_attachment_mime_for_data_url(mime: &str, filename: &str) -> String {
    let head = mime_type_only(mime);
    let mut m = head.to_lowercase();
    if m.is_empty() || m == "application/octet-stream" {
        if let Some(inf) = infer_mime_from_filename(filename) {
            m = inf.to_string();
        }
    }
    match m.as_str() {
        "audio/mp3" | "audio/x-mp3" | "audio/x-mpeg" | "audio/mpeg3" => "audio/mpeg".to_string(),
        "audio/x-m4a" => "audio/mp4".to_string(),
        _ => m,
    }
}

fn sanitize_base64_payload(b64: &str) -> String {
    b64.chars().filter(|c| !c.is_whitespace()).collect()
}

/// True when the URL has a non-empty payload after `;base64,` (llama-server rejects missing comma/data).
fn data_url_has_non_empty_base64_payload(url: &str) -> bool {
    let lower = url.to_lowercase();
    let Some(i) = lower.find(";base64,") else {
        return false;
    };
    let payload = &url[i + ";base64,".len()..];
    !sanitize_base64_payload(payload).is_empty()
}

/// Fix `data:` URLs for llama-server: strict `type/subtype;base64,payload` (no `codecs=` before base64).
fn normalize_leading_data_url(url: &str) -> String {
    const PREFIX: &str = "data:";
    if !url.starts_with(PREFIX) {
        return url.to_string();
    }
    let rest = &url[PREFIX.len()..];
    let lower = rest.to_lowercase();
    let needle = ";base64,";
    let Some(idx) = lower.find(needle) else {
        return url.to_string();
    };
    let header_raw = rest[..idx].trim();
    let payload = &rest[idx + needle.len()..];
    let mut m = mime_type_only(header_raw).to_lowercase();
    m = match m.as_str() {
        "audio/mp3" | "audio/x-mp3" | "audio/x-mpeg" | "audio/mpeg3" => "audio/mpeg".to_string(),
        "audio/x-m4a" => "audio/mp4".to_string(),
        _ => m,
    };
    format!("{PREFIX}{m};base64,{payload}")
}

/// llama.cpp mtmd decodes rasters with stb-style loaders; transcode to PNG so WebP/JPEG/TIFF/etc. decode reliably.
fn transcode_image_bytes_to_png_for_mtmd(bytes: &[u8]) -> Option<Vec<u8>> {
    let img = image::load_from_memory(bytes).ok()?;
    let mut out = Vec::new();
    img.write_to(&mut Cursor::new(&mut out), ImageFormat::Png).ok()?;
    Some(out)
}

/// Prefer PNG data URL after transcode when `file://` write fails or for fallbacks.
fn image_png_data_url_for_mtmd(mime_hint: &str, raw_bytes: &[u8]) -> Option<String> {
    if !mime_type_only(mime_hint).to_lowercase().starts_with("image/") {
        return None;
    }
    let png = transcode_image_bytes_to_png_for_mtmd(raw_bytes)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
    Some(format!("data:image/png;base64,{b64}"))
}

fn sanitize_attachment_filename(name: &str) -> String {
    let base = std::path::Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file.bin");
    let mut s = String::new();
    for c in base.chars() {
        if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
            s.push(c);
        } else {
            s.push('_');
        }
    }
    if s.is_empty() {
        "file.bin".to_string()
    } else {
        s
    }
}

/// Writes bytes under `{root}/{session}/` so llama-server can load them via `--media-path` + `file://…` (LM Studio / llama.cpp).
struct MediaSession {
    root: PathBuf,
    session: String,
    seq: u32,
}

impl MediaSession {
    fn new(root: PathBuf, session: String) -> Self {
        let _ = fs::create_dir_all(root.join(&session));
        Self {
            root,
            session,
            seq: 0,
        }
    }

    /// `transcode_image`: decode raster (any format the `image` crate supports) and save as PNG for llama.cpp mtmd.
    fn try_file_url_from_bytes(
        &mut self,
        suggested_name: &str,
        bytes: &[u8],
        transcode_image: bool,
    ) -> Result<String, String> {
        self.seq += 1;
        let (payload, fname) = if transcode_image {
            if let Some(png) = transcode_image_bytes_to_png_for_mtmd(bytes) {
                let base = sanitize_attachment_filename(suggested_name);
                let stem = Path::new(&base)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or("image");
                let stem_safe: String = stem.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
                let stem_safe = if stem_safe.is_empty() {
                    "image".to_string()
                } else {
                    stem_safe
                };
                (png, format!("{:04}_{}.png", self.seq, stem_safe))
            } else {
                let safe = sanitize_attachment_filename(suggested_name);
                (bytes.to_vec(), format!("{:04}_{}", self.seq, safe))
            }
        } else {
            let safe = sanitize_attachment_filename(suggested_name);
            (bytes.to_vec(), format!("{:04}_{}", self.seq, safe))
        };
        let path = self.root.join(&self.session).join(&fname);
        fs::write(&path, &payload).map_err(|e| e.to_string())?;
        let rel = format!("{}/{}", self.session, fname);
        Ok(format!("file://{}", rel.replace('\\', "/")))
    }
}

fn extract_bytes_from_data_url(url: &str) -> Option<Vec<u8>> {
    let lower = url.to_lowercase();
    let idx = lower.find(";base64,")?;
    let b64 = &url[idx + ";base64,".len()..];
    let clean = sanitize_base64_payload(b64);
    base64::engine::general_purpose::STANDARD
        .decode(clean.as_str())
        .ok()
}

/// Base64 payload after `;base64,` (for `input_audio.data`).
fn extract_base64_payload_from_data_url(url: &str) -> Option<String> {
    let lower = url.to_lowercase();
    let idx = lower.find(";base64,")?;
    let b64 = &url[idx + ";base64,".len()..];
    let clean = sanitize_base64_payload(b64);
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

/// MIME type segment of a `data:mime;base64,...` URL (lowercased, no parameters).
fn data_url_mime_header(url: &str) -> Option<String> {
    let t = url.trim_start();
    if !t.to_lowercase().starts_with("data:") {
        return None;
    }
    let rest = &t[5..];
    let idx = rest.find(';')?;
    Some(mime_type_only(&rest[..idx]).to_lowercase())
}

/// llama-server `input_audio` only accepts `wav` or `mp3` (see `server-common.cpp`).
fn oai_input_audio_format_for_mime(mime: &str) -> Option<&'static str> {
    let m = mime_type_only(mime).to_lowercase();
    match m.as_str() {
        "audio/wav" | "audio/x-wav" | "audio/wave" | "audio/vnd.wave" => Some("wav"),
        "audio/mpeg" | "audio/mp3" | "audio/x-mp3" | "audio/x-mpeg" | "audio/mpeg3" => Some("mp3"),
        _ => None,
    }
}

/// llama-server `handle_media` for `image_url` only allows `data:image/...;base64` — not `data:audio/...`
/// (that path throws and becomes HTTP 500). For WAV/MP3 bytes we use OpenAI-style `input_audio` instead.
fn push_openai_multimedia_part(parts: &mut Vec<serde_json::Value>, url: String) {
    let url_norm = normalize_leading_data_url(&url);
    if url_norm.to_lowercase().starts_with("data:audio/") {
        if let Some(mime) = data_url_mime_header(&url_norm) {
            if let Some(fmt) = oai_input_audio_format_for_mime(&mime) {
                if let Some(b64) = extract_base64_payload_from_data_url(&url_norm) {
                    parts.push(json!({
                        "type": "input_audio",
                        "input_audio": { "data": b64, "format": fmt }
                    }));
                    return;
                }
            }
        }
    }
    parts.push(json!({
        "type": "image_url",
        "image_url": { "url": url }
    }));
}

fn multimodal_url_kind(url: &str) -> Option<&'static str> {
    let l = url.to_lowercase();
    if l.starts_with("data:audio/") {
        return Some("audio");
    }
    if l.starts_with("data:video/") {
        return Some("video");
    }
    if l.starts_with("data:image/") {
        return Some("image");
    }
    if l.starts_with("file://") {
        if l.ends_with(".mp3")
            || l.ends_with(".wav")
            || l.ends_with(".flac")
            || l.ends_with(".ogg")
            || l.ends_with(".opus")
            || l.ends_with(".oga")
            || l.ends_with(".m4a")
            || l.ends_with(".aac")
        {
            return Some("audio");
        }
        if l.ends_with(".mp4")
            || l.ends_with(".webm")
            || l.ends_with(".mov")
            || l.ends_with(".avi")
            || l.ends_with(".mkv")
            || l.ends_with(".m4v")
            || l.ends_with(".ogv")
            || l.ends_with(".wmv")
        {
            return Some("video");
        }
        if l.ends_with(".png")
            || l.ends_with(".jpg")
            || l.ends_with(".jpeg")
            || l.ends_with(".webp")
            || l.ends_with(".gif")
        {
            return Some("image");
        }
    }
    None
}

/// Hugging Face Gemma demo sets `load_audio_from_video` when the batch contains video.
fn history_has_any_native_video(history_rows: &[(String, String)]) -> bool {
    for (role, raw) in history_rows {
        if role != "user" {
            continue;
        }
        if stored_user_content_has_native_video_media(raw) {
            return true;
        }
    }
    false
}

fn stored_user_content_has_native_video_media(content: &str) -> bool {
    let t = content.trim_start();
    if !t.starts_with('{') {
        return false;
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(content) else {
        return false;
    };
    if let Some(arr) = v.get("attachments").and_then(|x| x.as_array()) {
        for item in arr {
            let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
            let mime = item.get("mime").and_then(|x| x.as_str()).unwrap_or("");
            if attachment_native_media_kind(name, mime) == Some("video") {
                return true;
            }
        }
    }
    if let Some(img) = v.get("image").and_then(|x| x.as_str()) {
        if img.to_lowercase().starts_with("data:video/") {
            return true;
        }
    }
    false
}

fn infer_mime_from_filename(name: &str) -> Option<&'static str> {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        return Some("image/png");
    }
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        return Some("image/jpeg");
    }
    if lower.ends_with(".webp") {
        return Some("image/webp");
    }
    if lower.ends_with(".gif") {
        return Some("image/gif");
    }
    if lower.ends_with(".mp3") {
        return Some("audio/mpeg");
    }
    if lower.ends_with(".wav") {
        return Some("audio/wav");
    }
    if lower.ends_with(".m4a") {
        return Some("audio/mp4");
    }
    if lower.ends_with(".aac") {
        return Some("audio/aac");
    }
    if lower.ends_with(".flac") {
        return Some("audio/flac");
    }
    if lower.ends_with(".ogg") || lower.ends_with(".opus") || lower.ends_with(".oga") {
        return Some("audio/ogg");
    }
    if lower.ends_with(".mp4") || lower.ends_with(".m4v") {
        return Some("video/mp4");
    }
    if lower.ends_with(".webm") {
        return Some("video/webm");
    }
    if lower.ends_with(".mov") {
        return Some("video/quicktime");
    }
    if lower.ends_with(".mkv") {
        return Some("video/x-matroska");
    }
    if lower.ends_with(".avi") {
        return Some("video/x-msvideo");
    }
    if lower.ends_with(".ogv") {
        return Some("video/ogg");
    }
    if lower.ends_with(".wmv") {
        return Some("video/x-ms-wmv");
    }
    None
}

fn is_document_attachment_filename(name: &str) -> bool {
    let l = name.to_lowercase();
    l.ends_with(".pdf")
        || l.ends_with(".json")
        || l.ends_with(".txt")
        || l.ends_with(".md")
        || l.ends_with(".mdx")
        || l.ends_with(".csv")
        || l.ends_with(".log")
        || l.ends_with(".html")
        || l.ends_with(".htm")
        || l.ends_with(".xml")
        || l.ends_with(".yaml")
        || l.ends_with(".yml")
        || l.ends_with(".toml")
        || l.ends_with(".css")
        || l.ends_with(".scss")
        || l.ends_with(".less")
        || l.ends_with(".js")
        || l.ends_with(".mjs")
        || l.ends_with(".cjs")
        || l.ends_with(".ts")
        || l.ends_with(".tsx")
        || l.ends_with(".jsx")
        || l.ends_with(".vue")
        || l.ends_with(".svelte")
        || l.ends_with(".rs")
        || l.ends_with(".py")
        || l.ends_with(".go")
        || l.ends_with(".java")
        || l.ends_with(".kt")
        || l.ends_with(".swift")
        || l.ends_with(".c")
        || l.ends_with(".h")
        || l.ends_with(".cpp")
        || l.ends_with(".hpp")
        || l.ends_with(".cc")
        || l.ends_with(".cxx")
        || l.ends_with(".cs")
        || l.ends_with(".rb")
        || l.ends_with(".php")
        || l.ends_with(".sql")
        || l.ends_with(".sh")
        || l.ends_with(".bash")
        || l.ends_with(".zsh")
        || l.ends_with(".ps1")
        || l.ends_with(".env")
        || l.ends_with(".ini")
        || l.ends_with(".cfg")
        || l.ends_with(".conf")
        || l.ends_with(".tex")
        || l.ends_with(".bib")
}

/// Native mmproj media kind for an attachment; `None` for document-style files (text extracted separately).
fn attachment_native_media_kind(name: &str, mime: &str) -> Option<&'static str> {
    if is_document_attachment_filename(name) {
        return None;
    }
    let m = mime_type_only(mime).to_lowercase();
    if m.starts_with("image/") {
        return Some("image");
    }
    if m.starts_with("audio/") {
        return Some("audio");
    }
    if m.starts_with("video/") {
        return Some("video");
    }
    if let Some(im) = infer_mime_from_filename(name) {
        if im.starts_with("image/") {
            return Some("image");
        }
        if im.starts_with("audio/") {
            return Some("audio");
        }
        if im.starts_with("video/") {
            return Some("video");
        }
    }
    None
}

/// Same rules as the Gemma 4 E4B Hugging Face demo: one media family per message (many images, or one audio, or one video).
fn validate_user_content_media_rules(
    content: &str,
    image_data_url_extra: Option<&str>,
) -> Result<(), String> {
    let mut n_img: u32 = 0;
    let mut n_aud: u32 = 0;
    let mut n_vid: u32 = 0;

    let t = content.trim_start();
    if t.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(content) {
            if let Some(arr) = v.get("attachments").and_then(|x| x.as_array()) {
                for item in arr {
                    let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    let mime = item.get("mime").and_then(|x| x.as_str()).unwrap_or("");
                    let Some(k) = attachment_native_media_kind(name, mime) else {
                        continue;
                    };
                    match k {
                        "image" => n_img += 1,
                        "audio" => n_aud += 1,
                        "video" => n_vid += 1,
                        _ => {}
                    }
                }
            }
            if let Some(img) = v.get("image").and_then(|x| x.as_str()) {
                let s = img.trim();
                if !s.is_empty() {
                    let lower = s.to_lowercase();
                    if lower.starts_with("data:image/") {
                        n_img += 1;
                    } else if lower.starts_with("data:audio/") {
                        n_aud += 1;
                    } else if lower.starts_with("data:video/") {
                        n_vid += 1;
                    }
                }
            }
        }
    }

    if let Some(url) = image_data_url_extra.filter(|s| !s.trim().is_empty()) {
        let lower = url.to_lowercase();
        if lower.starts_with("data:image/") {
            n_img += 1;
        } else if lower.starts_with("data:audio/") {
            n_aud += 1;
        } else if lower.starts_with("data:video/") {
            n_vid += 1;
        }
    }

    let mut n_kinds: u32 = 0;
    if n_img > 0 {
        n_kinds += 1;
    }
    if n_aud > 0 {
        n_kinds += 1;
    }
    if n_vid > 0 {
        n_kinds += 1;
    }
    if n_kinds > 1 {
        return Err(
            "Use only one kind of media per message (images, or one audio, or one video).".into(),
        );
    }
    if n_aud > 1 {
        return Err("Only one audio file per message.".into());
    }
    if n_vid > 1 {
        return Err("Only one video file per message.".into());
    }
    Ok(())
}

/// True when mime (or file extension) indicates image / audio / video bytes for llama.cpp MTMD
/// (`image_url` with `file://` or data URLs, or `input_audio` for `data:audio/` wav/mp3 — see `push_openai_multimedia_part`).
fn is_native_media_mime(mime: &str, filename: &str) -> bool {
    let m = mime_type_only(mime).to_lowercase();
    if m.starts_with("image/") || m.starts_with("audio/") || m.starts_with("video/") {
        return true;
    }
    infer_mime_from_filename(filename)
        .map(|im| {
            im.starts_with("image/")
                || im.starts_with("audio/")
                || im.starts_with("video/")
        })
        .unwrap_or(false)
}

/// v2 JSON with at least one image/audio/video attachment (needs `--mmproj` / multimodal server).
fn user_json_has_native_media_attachments(content: &str) -> bool {
    let t = content.trim_start();
    if !t.starts_with('{') {
        return false;
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(content) else {
        return false;
    };
    if v.get("v").and_then(|x| x.as_u64()) != Some(2) {
        return false;
    }
    let Some(arr) = v.get("attachments").and_then(|x| x.as_array()) else {
        return false;
    };
    for item in arr {
        let mime = item
            .get("mime")
            .and_then(|x| x.as_str())
            .unwrap_or("application/octet-stream");
        let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
        let mut m = mime.to_string();
        if mime_type_only(&m).eq_ignore_ascii_case("application/octet-stream") {
            if let Some(inf) = infer_mime_from_filename(name) {
                m = inf.to_string();
            }
        }
        if is_native_media_mime(&m, name) {
            return true;
        }
    }
    false
}

fn decode_utf8_from_base64(b64: &str) -> Option<String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .ok()?;
    String::from_utf8(bytes).ok()
}

/// Expand stored user message (plain or JSON v1/v2) into a single text block for the local LLM.
fn expand_user_stored_for_llm(raw: &str) -> String {
    let trimmed = raw.trim_start();
    if trimmed.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(2) {
                return expand_v2_text_for_llm(&v);
            }
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) {
                return v.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string();
            }
        }
    }
    raw.to_string()
}

fn expand_v2_text_for_llm(v: &serde_json::Value) -> String {
    let cap = v.get("text").and_then(|x| x.as_str()).unwrap_or("");
    let mut parts: Vec<String> = Vec::new();
    if !cap.trim().is_empty() {
        parts.push(cap.trim().to_string());
    }
    if let Some(arr) = v.get("attachments").and_then(|x| x.as_array()) {
        for item in arr {
            let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("attachment");
            let mime = item
                .get("mime")
                .and_then(|x| x.as_str())
                .unwrap_or("application/octet-stream");
            let mut m = mime.to_string();
            if m == "application/octet-stream" {
                if let Some(inf) = infer_mime_from_filename(name) {
                    m = inf.to_string();
                }
            }
            if is_native_media_mime(&m, name) {
                continue;
            }
            let body = item
                .get("extractedText")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    item.get("dataBase64")
                        .and_then(|x| x.as_str())
                        .and_then(decode_utf8_from_base64)
                })
                .unwrap_or_else(|| format!("[Could not decode text; mime: {mime}]"));
            parts.push(format!("[Attachment: {name}]\n{body}"));
        }
    }
    parts.join("\n\n")
}

fn build_v2_openai_user_message(
    v: &serde_json::Value,
    media: &mut Option<MediaSession>,
) -> serde_json::Value {
    let doc_text = expand_v2_text_for_llm(v);
    let mut media_urls: Vec<String> = Vec::new();

    if let Some(arr) = v.get("attachments").and_then(|x| x.as_array()) {
        for item in arr {
            let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("file");
            let mime_raw = item
                .get("mime")
                .and_then(|x| x.as_str())
                .unwrap_or("application/octet-stream");
            let mut mime = mime_raw.to_string();
            if mime_type_only(&mime).eq_ignore_ascii_case("application/octet-stream") {
                if let Some(inf) = infer_mime_from_filename(name) {
                    mime = inf.to_string();
                }
            }
            if !is_native_media_mime(&mime, name) {
                continue;
            }
            let Some(b64_raw) = item.get("dataBase64").and_then(|x| x.as_str()) else {
                continue;
            };
            let b64 = sanitize_base64_payload(b64_raw);
            if b64.is_empty() {
                continue;
            }
            let canon_mime = normalize_attachment_mime_for_data_url(&mime, name);
            let data_url = format!("data:{};base64,{}", canon_mime, b64);
            if !data_url_has_non_empty_base64_payload(&data_url) {
                continue;
            }
            let is_image = mime_type_only(&canon_mime)
                .to_lowercase()
                .starts_with("image/");
            let url = if let Some(ms) = media.as_mut() {
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.as_str()) {
                    ms.try_file_url_from_bytes(name, &bytes, is_image)
                        .unwrap_or_else(|_| {
                            if is_image {
                                image_png_data_url_for_mtmd(&canon_mime, &bytes)
                                    .unwrap_or_else(|| data_url.clone())
                            } else {
                                data_url.clone()
                            }
                        })
                } else {
                    data_url.clone()
                }
            } else {
                data_url.clone()
            };
            media_urls.push(url);
        }
    }

    if let Some(img) = v
        .get("image")
        .and_then(|x| x.as_str())
        .filter(|s| !s.trim().is_empty())
    {
        let u_norm = normalize_leading_data_url(img);
        if data_url_has_non_empty_base64_payload(&u_norm) {
            let url = if let Some(ms) = media.as_mut() {
                if let Some(bytes) = extract_bytes_from_data_url(&u_norm) {
                    ms.try_file_url_from_bytes("pasted_image.png", &bytes, true)
                        .unwrap_or_else(|_| {
                            let mh = data_url_mime_header(&u_norm).unwrap_or_else(|| "image/png".to_string());
                            image_png_data_url_for_mtmd(&mh, &bytes).unwrap_or_else(|| u_norm.clone())
                        })
                } else {
                    u_norm.clone()
                }
            } else {
                u_norm.clone()
            };
            media_urls.push(url);
        }
    }

    if media_urls.is_empty() {
        return json!({ "role": "user", "content": doc_text });
    }

    let mut has_audio = false;
    let mut has_video = false;
    let mut has_image = false;
    for u in &media_urls {
        match multimodal_url_kind(u) {
            Some("audio") => has_audio = true,
            Some("video") => has_video = true,
            Some("image") => has_image = true,
            _ => {}
        }
    }

    let default_prompt = if has_audio && !has_video && !has_image {
        "Transcribe or respond to this audio as appropriate.".to_string()
    } else if has_video {
        "Describe what you see and hear in this video, or answer the user's question.".to_string()
    } else if has_image {
        "Describe this image.".to_string()
    } else {
        "Describe this.".to_string()
    };

    let text_for_api = if doc_text.trim().is_empty() {
        default_prompt
    } else {
        doc_text
    };

    let mut content_parts = vec![json!({
        "type": "text",
        "text": text_for_api
    })];
    for url in media_urls {
        push_openai_multimedia_part(&mut content_parts, url);
    }

    json!({
        "role": "user",
        "content": content_parts
    })
}

/// OpenAI-style user message: string content, or multimodal array when an image is present (v1 or v2).
fn user_openai_message_value(raw: &str, media: &mut Option<MediaSession>) -> serde_json::Value {
    let trimmed = raw.trim_start();
    if trimmed.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(2) {
                return build_v2_openai_user_message(&v, media);
            }
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) && v.get("image").is_some() {
                let cap = v.get("text").and_then(|x| x.as_str()).unwrap_or("");
                let img = v.get("image").and_then(|x| x.as_str()).unwrap_or("");
                let img_norm = normalize_leading_data_url(img);
                if data_url_has_non_empty_base64_payload(&img_norm) {
                    let text_for_api = if cap.trim().is_empty() {
                        "Describe this image.".to_string()
                    } else {
                        cap.to_string()
                    };
                    let url = if let Some(ms) = media.as_mut() {
                        if let Some(bytes) = extract_bytes_from_data_url(&img_norm) {
                            ms.try_file_url_from_bytes("vision_image.png", &bytes, true)
                                .unwrap_or_else(|_| {
                                    let mh = data_url_mime_header(&img_norm)
                                        .unwrap_or_else(|| "image/png".to_string());
                                    image_png_data_url_for_mtmd(&mh, &bytes)
                                        .unwrap_or_else(|| img_norm.clone())
                                })
                        } else {
                            img_norm.clone()
                        }
                    } else {
                        img_norm.clone()
                    };
                    return json!({
                        "role": "user",
                        "content": [
                            { "type": "text", "text": text_for_api },
                            { "type": "image_url", "image_url": { "url": url } }
                        ]
                    });
                }
            }
        }
    }
    json!({ "role": "user", "content": expand_user_stored_for_llm(raw) })
}

fn apply_think_mode_json(messages: &mut Vec<serde_json::Value>, think: bool) {
    if !think {
        return;
    }
    const SUFFIX: &str = "\n\nFor non-trivial questions, briefly outline your reasoning or steps, then give a clear final answer.";
    if messages.is_empty() {
        messages.push(json!({
            "role": "system",
            "content": format!("You are a helpful assistant.{SUFFIX}")
        }));
        return;
    }
    if messages[0].get("role").and_then(|r| r.as_str()) == Some("system") {
        let cur = messages[0]
            .get("content")
            .and_then(|c| c.as_str().map(|s| s.to_string()));
        if let Some(mut s) = cur {
            s.push_str(SUFFIX);
            messages[0]["content"] = json!(s);
        }
    } else {
        messages.insert(
            0,
            json!({
                "role": "system",
                "content": format!("You are a helpful assistant.{SUFFIX}")
            }),
        );
    }
}

/// Static facts about the running app so the local model can answer “what app is this?”, “what time is it?”, etc.
/// Does not include secrets (API keys, PINs, paths).
fn build_app_context(settings: &AppSettings) -> String {
    let version = env!("CARGO_PKG_VERSION");
    let now = Local::now().format("%Y-%m-%d %H:%M:%S (local timezone)").to_string();
    let lang = settings.language.trim();
    let lang_line = if lang.is_empty() {
        "en".to_string()
    } else {
        lang.to_string()
    };
    let theme = settings.theme.trim();
    let theme_line = if theme.is_empty() {
        "unspecified".to_string()
    } else {
        theme.to_string()
    };
    let mut lines: Vec<String> = vec![
        "You are the assistant inside the Athena desktop application. Use the facts below when the user asks about the app, the time, their name, or UI preferences—do not claim you cannot know the current time or app name; the information is provided here.".to_string(),
        String::new(),
        format!("App name: Athena"),
        format!("App version: {version}"),
        format!("Current date and time (user's device, local): {now}"),
        format!("UI language (BCP-47): {lang_line}"),
        format!("Theme: {theme_line}"),
        format!(
            "Developer mode (extra UI): {}",
            if settings.developer_mode { "on" } else { "off" }
        ),
    ];
    if !settings.default_model.trim().is_empty() {
        lines.push(format!(
            "Default model id in settings: {}",
            settings.default_model.trim()
        ));
    }
    if !settings.runtime_variant.trim().is_empty() {
        lines.push(format!(
            "Bundled llama.cpp runtime flavor: {}",
            settings.runtime_variant.trim()
        ));
    }
    lines.join("\n")
}

fn personalized_system_content(settings: &AppSettings, active_model_id: Option<&str>) -> String {
    let app_block = build_app_context(settings);
    let mut blocks: Vec<String> = Vec::new();
    if !settings.profile_full_name.trim().is_empty() {
        blocks.push(format!(
            "User / owner name (from app Profile): {}",
            settings.profile_full_name.trim()
        ));
    }
    if !settings.profile_nickname.trim().is_empty() {
        blocks.push(format!(
            "Display nickname (Profile): {}",
            settings.profile_nickname.trim()
        ));
    }
    if !settings.profile_occupation.trim().is_empty() {
        blocks.push(format!("Occupation: {}", settings.profile_occupation.trim()));
    }
    if !settings.profile_about_me.trim().is_empty() {
        blocks.push(format!("About the user: {}", settings.profile_about_me.trim()));
    }
    if !settings.personal_custom_instructions.trim().is_empty() {
        blocks.push(format!(
            "User's custom instructions: {}",
            settings.personal_custom_instructions.trim()
        ));
    }
    if !settings.personal_nickname.trim().is_empty() {
        blocks.push(format!(
            "The user prefers to be called: {}",
            settings.personal_nickname.trim()
        ));
    }
    if !settings.personal_more_about_you.trim().is_empty() {
        blocks.push(format!(
            "More about the user: {}",
            settings.personal_more_about_you.trim()
        ));
    }
    if settings.personal_memory_enabled && !settings.personal_memory_blob.trim().is_empty() {
        blocks.push(format!(
            "Long-term memory notes (reference when helpful):\n{}",
            settings.personal_memory_blob.trim()
        ));
    }
    let mut sys = app_block;
    if !settings.system_prompt.trim().is_empty() {
        sys.push_str("\n\n---\n");
        sys.push_str(settings.system_prompt.trim());
    }
    if !blocks.is_empty() {
        sys.push_str("\n\n---\nProfile & preferences (from Athena settings):\n\n");
        sys.push_str(&blocks.join("\n\n"));
    }
    if let Some(mid) = active_model_id.map(str::trim).filter(|s| !s.is_empty()) {
        sys.push_str(&format!("\n\nModel id used for this reply: {mid}"));
    }
    sys
}

fn with_personalization(
    settings: &AppSettings,
    messages: Vec<ChatMsg>,
    active_model_id: Option<&str>,
) -> Vec<ChatMsg> {
    let sys = personalized_system_content(settings, active_model_id);
    let mut out = vec![ChatMsg {
        role: "system".into(),
        content: sys,
    }];
    out.extend(messages);
    out
}

const DEFAULT_THREAD_COLOR: &str = "#64748b";

fn thread_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Thread> {
    Ok(Thread {
        id: r.get(0)?,
        title: r.get(1)?,
        model_id: r.get(2)?,
        created_at: r.get(3)?,
        updated_at: r.get(4)?,
        pinned: r.get::<_, i64>(5)? != 0,
        project_id: r.get(6)?,
        color: r.get(7)?,
    })
}

fn model_path_for_id(settings: &crate::types::AppSettings, model_id: &str) -> Result<String, String> {
    let dir = manager::ensure_models_dir(Path::new(&settings.data_dir)).map_err(|e| e.to_string())?;
    manager::resolve_gguf_path(&dir, model_id)
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| format!("model file not found for id {model_id}"))
}

#[tauri::command]
pub fn create_thread(db: State<'_, Db>, title: String) -> Result<Thread, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    conn.execute(
        "INSERT INTO threads (id, title, model_id, created_at, updated_at, pinned, project_id, color) VALUES (?1, ?2, NULL, ?3, ?4, 0, NULL, ?5)",
        params![id, title, now, now, DEFAULT_THREAD_COLOR],
    )
    .map_err(|e| e.to_string())?;
    Ok(Thread {
        id,
        title,
        model_id: None,
        created_at: now,
        updated_at: now,
        pinned: false,
        project_id: None,
        color: DEFAULT_THREAD_COLOR.into(),
    })
}

#[tauri::command]
pub fn list_threads(db: State<'_, Db>) -> Result<Vec<Thread>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, model_id, created_at, updated_at, pinned, project_id, color FROM threads ORDER BY pinned DESC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], thread_from_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn delete_thread(db: State<'_, Db>, thread_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Delete messages first so this always works even if an older DB missed ON DELETE CASCADE.
    conn.execute(
        "DELETE FROM messages WHERE thread_id = ?1",
        [&thread_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM threads WHERE id = ?1", [&thread_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_threads(db: State<'_, Db>, ids: Vec<String>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    for thread_id in &ids {
        conn.execute(
            "DELETE FROM messages WHERE thread_id = ?1",
            [thread_id],
        )
        .map_err(|e| e.to_string())?;
        conn
            .execute("DELETE FROM threads WHERE id = ?1", [thread_id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_thread(db: State<'_, Db>, thread_id: String, title: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp();
    conn.execute(
        "UPDATE threads SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, thread_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_thread_pinned(db: State<'_, Db>, thread_id: String) -> Result<Thread, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let cur: i64 = conn
        .query_row("SELECT pinned FROM threads WHERE id = ?1", [&thread_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let next: i32 = if cur == 0 { 1 } else { 0 };
    let now = Utc::now().timestamp();
    conn.execute(
        "UPDATE threads SET pinned = ?1, updated_at = ?2 WHERE id = ?3",
        params![next, now, thread_id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, model_id, created_at, updated_at, pinned, project_id, color FROM threads WHERE id = ?1",
        [&thread_id],
        thread_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_thread_project(
    db: State<'_, Db>,
    thread_id: String,
    project_id: Option<String>,
) -> Result<Thread, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref pid) = project_id {
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects WHERE id = ?1", [pid], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("Project not found".into());
        }
    }
    let now = Utc::now().timestamp();
    conn.execute(
        "UPDATE threads SET project_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![project_id, now, thread_id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, model_id, created_at, updated_at, pinned, project_id, color FROM threads WHERE id = ?1",
        [&thread_id],
        thread_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_thread_color(
    db: State<'_, Db>,
    thread_id: String,
    color: String,
) -> Result<Thread, String> {
    let color = color.trim().to_string();
    if color.is_empty() {
        return Err("Color is required".into());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp();
    conn.execute(
        "UPDATE threads SET color = ?1, updated_at = ?2 WHERE id = ?3",
        params![color, now, thread_id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, model_id, created_at, updated_at, pinned, project_id, color FROM threads WHERE id = ?1",
        [&thread_id],
        thread_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_threads_color(db: State<'_, Db>, ids: Vec<String>, color: String) -> Result<(), String> {
    let color = color.trim().to_string();
    if color.is_empty() {
        return Err("Color is required".into());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp();
    for thread_id in &ids {
        conn.execute(
            "UPDATE threads SET color = ?1, updated_at = ?2 WHERE id = ?3",
            params![color, now, thread_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn assign_threads_project(
    db: State<'_, Db>,
    thread_ids: Vec<String>,
    project_id: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref pid) = project_id {
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects WHERE id = ?1", [pid], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("Project not found".into());
        }
    }
    let now = Utc::now().timestamp();
    for tid in &thread_ids {
        conn
            .execute(
                "UPDATE threads SET project_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![project_id, now, tid],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_thread_messages(db: State<'_, Db>, thread_id: String) -> Result<Vec<Message>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, thread_id, role, content, model_id, tokens_used, created_at FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC, rowid ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&thread_id], |r| {
            Ok(Message {
                id: r.get(0)?,
                thread_id: r.get(1)?,
                role: r.get(2)?,
                content: r.get(3)?,
                model_id: r.get(4)?,
                tokens_used: r.get(5)?,
                created_at: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn clear_thread_messages(db: State<'_, Db>, thread_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE thread_id = ?1", [thread_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_last_assistant_message(db: State<'_, Db>, thread_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM messages WHERE id = (SELECT id FROM messages WHERE thread_id = ?1 AND role = 'assistant' ORDER BY created_at DESC LIMIT 1)",
        [&thread_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Deletes this message and every message after it in the thread (by `created_at`).
/// Used for regenerate (assistant), retry/edit (user), etc.
#[tauri::command]
pub fn delete_messages_from(db: State<'_, Db>, thread_id: String, message_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Tie-break with SQLite `rowid`: user + assistant often share the same `created_at` second,
    // so `created_at >= anchor` alone would delete the user turn too and break regenerate/retry.
    let n = conn
        .execute(
            "DELETE FROM messages WHERE thread_id = ?1 AND (created_at, rowid) >= (
                SELECT m.created_at, m.rowid FROM messages m WHERE m.id = ?2 AND m.thread_id = ?1
            )",
            params![thread_id, message_id],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("message not found in thread".into());
    }
    Ok(())
}

#[tauri::command]
pub fn clear_all_conversations(db: State<'_, Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM threads", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn send_message(
    db: State<'_, Db>,
    inference: State<'_, InferenceHandle>,
    thread_id: String,
    content: String,
    model_id: String,
) -> Result<Message, String> {
    let (settings, path, history) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
        let path = model_path_for_id(&settings, &model_id)?;
        let mut stmt = conn
            .prepare("SELECT role, content FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC, rowid ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&thread_id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut history: Vec<ChatMsg> = Vec::new();
        for row in rows {
            let (role, c) = row.map_err(|e| e.to_string())?;
            let content = if role == "user" {
                expand_user_stored_for_llm(&c)
            } else {
                api_text_for_stored_message(&role, &c)
            };
            history.push(ChatMsg { role, content });
        }
        (settings, path, history)
    };

    let uid = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, thread_id, role, content, model_id, tokens_used, created_at) VALUES (?1, ?2, 'user', ?3, ?4, 0, ?5)",
            params![uid, thread_id, content, model_id, now],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE threads SET model_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![model_id, now, thread_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut messages = history;
    messages.push(ChatMsg {
        role: "user".into(),
        content: expand_user_stored_for_llm(&content),
    });
    let messages = with_personalization(&settings, messages, Some(model_id.as_str()));

    let mmproj_path = mmproj::resolve_mmproj_path(Path::new(&settings.data_dir), &model_id)
        .map_err(|e| e.to_string())?;

    let base = inference
        .0
        .ensure_llama_server(
            Path::new(&path),
            mmproj_path.as_deref(),
            &settings,
        )
        .await
        .map_err(|e| e.to_string())?;

    let reply = inference
        .0
        .chat_complete(
            &base,
            messages,
            settings.temperature,
            settings.max_tokens,
            json!({ "enable_thinking": false }),
        )
        .await
        .map_err(|e| e.to_string())?;

    let aid = Uuid::new_v4().to_string();
    let now2 = Utc::now().timestamp();
    let tok_ins: i64 = serde_json::from_str::<serde_json::Value>(&reply)
        .ok()
        .and_then(|p| p.get("completionTokens").and_then(|x| x.as_u64()))
        .unwrap_or(0) as i64;
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, thread_id, role, content, model_id, tokens_used, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4, ?5, ?6)",
            params![aid, thread_id, reply, model_id, tok_ins, now2],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE threads SET updated_at = ?1 WHERE id = ?2",
            params![now2, thread_id],
        )
        .map_err(|e| e.to_string())?;
    }

    maybe_auto_title_thread(&*db, &inference, &base, &thread_id).await;

    Ok(Message {
        id: aid,
        thread_id,
        role: "assistant".into(),
        content: reply,
        model_id: Some(model_id),
        tokens_used: if tok_ins > 0 { Some(tok_ins) } else { None },
        created_at: now2,
    })
}

#[tauri::command]
pub async fn stream_chat(
    window: Window,
    db: State<'_, Db>,
    inference: State<'_, InferenceHandle>,
    cancel: State<'_, StreamCancel>,
    thread_id: String,
    content: String,
    model_id: String,
    skip_user_insert: Option<bool>,
    // `data:image/...;base64,...` for multimodal (vision); requires llama-server + mmproj for VL models.
    image_data_url: Option<String>,
    // Composer "Think" toggle — adds a system instruction encouraging structured reasoning.
    think_enabled: Option<bool>,
) -> Result<(), String> {
    let stop = cancel.0.clone();
    stop.store(false, Ordering::SeqCst);
    let skip = skip_user_insert.unwrap_or(false);

    let settings = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    validate_user_content_media_rules(&content, image_data_url.as_deref())?;
    let path = model_path_for_id(&settings, &model_id)?;
    let mmproj_path = mmproj::resolve_mmproj_path(Path::new(&settings.data_dir), &model_id)
        .map_err(|e| e.to_string())?;
    let needs_multimodal = image_data_url.as_ref().is_some_and(|s| !s.trim().is_empty())
        || user_json_has_image(&content)
        || user_json_has_native_media_attachments(&content);
    if needs_multimodal && mmproj_path.is_none() {
        return Err(
            "Multimodal input (image, audio, or video) requires the mmproj GGUF for this model. Download the Gemma multimodal bundle from the catalog (main weights + mmproj) or place the matching mmproj next to your GGUF."
                .into(),
        );
    }

    let content_for_db = user_content_for_database(&content, image_data_url.as_deref());

    if !skip {
        let uid = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO messages (id, thread_id, role, content, model_id, tokens_used, created_at) VALUES (?1, ?2, 'user', ?3, ?4, 0, ?5)",
                params![uid, thread_id, content_for_db, model_id, now],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE threads SET model_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![model_id, now, thread_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    let history_rows: Vec<(String, String)> = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT role, content FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC, rowid ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&thread_id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        out
    };

    let media_root = Path::new(&settings.data_dir).join("inference_media");
    let _ = fs::create_dir_all(&media_root);
    let session_id = Uuid::new_v4().to_string();
    let mut media_session: Option<MediaSession> = if mmproj_path.is_some() {
        Some(MediaSession::new(media_root.clone(), session_id.clone()))
    } else {
        None
    };
    let cleanup_dir = mmproj_path
        .as_ref()
        .map(|_| media_root.join(&session_id));

    let history_has_video = history_has_any_native_video(&history_rows);

    let mut history_json: Vec<serde_json::Value> = Vec::new();
    for (role, raw) in &history_rows {
        if role == "assistant" {
            history_json.push(json!({
                "role": "assistant",
                "content": api_text_for_stored_message("assistant", raw)
            }));
        } else {
            history_json.push(user_openai_message_value(raw, &mut media_session));
        }
    }

    let mut messages_json: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": personalized_system_content(&settings, Some(model_id.as_str()))
    })];
    messages_json.extend(history_json);
    apply_think_mode_json(&mut messages_json, think_enabled.unwrap_or(false));

    let base = inference
        .0
        .ensure_llama_server(
            Path::new(&path),
            mmproj_path.as_deref(),
            &settings,
        )
        .await
        .map_err(|e| e.to_string())?;

    let t0 = Instant::now();
    let mut reasoning = String::new();
    let mut content = String::new();
    let thread_id_emit = thread_id.clone();
    let think = think_enabled.unwrap_or(false);
    // When false (composer bulb off): tell llama-server to disable native thinking (Qwen3, etc.) + merge any stray tokens into one stream.
    // When true: separate reasoning_content in UI and stored JSON.
    let split_reasoning = think;
    let mut chat_template_kwargs = json!({ "enable_thinking": think });
    if history_has_video {
        if let Some(obj) = chat_template_kwargs.as_object_mut() {
            obj.insert("load_audio_from_video".to_string(), json!(true));
        }
    }
    let stream_res = inference
        .0
        .chat_complete_stream_json(
            &base,
            serde_json::Value::Array(messages_json),
            settings.temperature,
            settings.max_tokens,
            chat_template_kwargs,
            think,
            |delta, is_reasoning| {
                if stop.load(Ordering::SeqCst) {
                    return false;
                }
                let use_reasoning_channel = split_reasoning && is_reasoning;
                if use_reasoning_channel {
                    reasoning.push_str(delta);
                } else {
                    content.push_str(delta);
                }
                let kind = if use_reasoning_channel {
                    "reasoning"
                } else {
                    "content"
                };
                let _ = window.emit(
                    "athena-token",
                    json!({
                        "threadId": thread_id_emit,
                        "token": delta,
                        "kind": kind,
                    }),
                );
                true
            },
        )
        .await;

    if let Some(ref d) = cleanup_dir {
        let _ = fs::remove_dir_all(d);
    }

    let usage = stream_res.map_err(|e| e.to_string())?;

    let gen_ms = t0.elapsed().as_millis() as u64;
    let stored =
        InferenceEngine::assistant_blob_json(&reasoning, &content, Some(gen_ms), &usage);
    let tok_ins = usage
        .completion_tokens
        .map(|t| t as i64)
        .unwrap_or(0);

    let aid = Uuid::new_v4().to_string();
    let now2 = Utc::now().timestamp();
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, thread_id, role, content, model_id, tokens_used, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4, ?5, ?6)",
            params![aid, thread_id, stored, model_id, tok_ins, now2],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE threads SET updated_at = ?1 WHERE id = ?2",
            params![now2, thread_id],
        )
        .map_err(|e| e.to_string())?;
    }

    maybe_auto_title_thread(&*db, &inference, &base, &thread_id).await;

    Ok(())
}

#[tauri::command]
pub fn delete_message(db: State<'_, Db>, thread_id: String, message_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let n = conn
        .execute(
            "DELETE FROM messages WHERE id = ?1 AND thread_id = ?2",
            params![message_id, thread_id],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("message not found".into());
    }
    Ok(())
}

#[tauri::command]
pub fn stop_streaming(cancel: State<'_, StreamCancel>) -> Result<(), String> {
    cancel.0.store(true, Ordering::SeqCst);
    Ok(())
}
