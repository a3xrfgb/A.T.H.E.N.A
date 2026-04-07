use crate::types::{GalleryImage, NanoBananaPageResult};
use once_cell::sync::OnceCell;
use regex::Regex;
use reqwest::Client;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tokio::sync::Mutex;

fn gallery_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())
}

// --- Nano Banana Pro: lazy-paged catalog from YouMind Open Lab reference JSON (same source as their official skill). ---

const NANO_REF_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill/main/references/manifest.json";
const NANO_REF_BASE: &str =
    "https://raw.githubusercontent.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill/main/references/";

#[derive(Debug, Deserialize)]
struct NanoManifest {
    categories: Vec<NanoManifestCategory>,
}

#[derive(Debug, Deserialize)]
struct NanoManifestCategory {
    file: String,
    count: usize,
}

#[derive(Debug, Deserialize)]
struct NanoRefRow {
    id: u64,
    content: String,
    title: Option<String>,
    #[serde(default, rename = "sourceMedia")]
    source_media: Vec<String>,
}

fn normalize_nano_prompt_text(content: &str) -> String {
    let t = content.trim();
    if t.is_empty() {
        return String::new();
    }
    if t.starts_with('"') && t.ends_with('"') && t.len() > 1 {
        if let Ok(unquoted) = serde_json::from_str::<String>(t) {
            return unquoted;
        }
    }
    t.to_string()
}

fn nano_ref_row_to_gallery(row: NanoRefRow) -> Option<GalleryImage> {
    let src = row.source_media.first()?.trim();
    if src.is_empty() {
        return None;
    }
    let prompt = normalize_nano_prompt_text(&row.content);
    if prompt.trim().len() < 8 {
        return None;
    }
    let id = row.id;
    let title = row
        .title
        .filter(|s| !s.trim().is_empty())
        .or_else(|| Some(format!("youmind-{id}")));
    Some(GalleryImage {
        src: src.to_string(),
        href: Some(format!("https://youmind.com/nano-banana-pro-prompts?id={id}")),
        source: "nanoBanana".to_string(),
        title,
        prompt: Some(prompt),
    })
}

async fn fetch_nano_category_file(client: &Client, file: &str) -> Result<Vec<GalleryImage>, String> {
    let url = format!("{NANO_REF_BASE}{file}");
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Nano reference HTTP {} ({file})", res.status()));
    }
    let text = res.text().await.map_err(|e| e.to_string())?;
    let rows: Vec<NanoRefRow> =
        serde_json::from_str(&text).map_err(|e| format!("Nano JSON {file}: {e}"))?;
    Ok(rows.into_iter().filter_map(nano_ref_row_to_gallery).collect())
}

struct NanoRefsState {
    category_files: Vec<String>,
    /// Manifest `count` until loaded; then replaced by parsed row count (after `sourceMedia` filter).
    per_cat_len: Vec<usize>,
    loaded: HashMap<String, Vec<GalleryImage>>,
}

impl NanoRefsState {
    fn total(&self) -> usize {
        self.per_cat_len.iter().sum()
    }

    async fn ensure_manifest(&mut self, client: &Client) -> Result<(), String> {
        if !self.category_files.is_empty() {
            return Ok(());
        }
        let res = client
            .get(NANO_REF_MANIFEST_URL)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("Nano manifest HTTP {}", res.status()));
        }
        let text = res.text().await.map_err(|e| e.to_string())?;
        let m: NanoManifest = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        for c in m.categories {
            self.category_files.push(c.file);
            self.per_cat_len.push(c.count);
        }
        Ok(())
    }

    async fn ensure_category(&mut self, client: &Client, idx: usize) -> Result<(), String> {
        let file = self
            .category_files
            .get(idx)
            .ok_or_else(|| "invalid nano category".to_string())?
            .clone();
        if self.loaded.contains_key(&file) {
            return Ok(());
        }
        let items = fetch_nano_category_file(client, &file).await?;
        self.per_cat_len[idx] = items.len();
        self.loaded.insert(file, items);
        Ok(())
    }

    async fn fetch_page_slice(
        &mut self,
        client: &Client,
        offset: usize,
        limit: usize,
    ) -> Result<Vec<GalleryImage>, String> {
        self.ensure_manifest(client).await?;
        let limit = limit.max(1);
        let mut skip = offset;
        let mut out = Vec::new();
        for idx in 0..self.category_files.len() {
            self.ensure_category(client, idx).await?;
            let file = &self.category_files[idx];
            let vec = self.loaded.get(file).expect("just loaded");
            if skip >= vec.len() {
                skip -= vec.len();
                continue;
            }
            let from = skip;
            skip = 0;
            let need = limit - out.len();
            let take = need.min(vec.len() - from);
            out.extend(vec[from..from + take].iter().cloned());
            if out.len() >= limit {
                break;
            }
        }
        Ok(out)
    }
}

static NANO_REFS: OnceCell<Mutex<NanoRefsState>> = OnceCell::new();

fn nano_refs_mutex() -> &'static Mutex<NanoRefsState> {
    NANO_REFS.get_or_init(|| {
        Mutex::new(NanoRefsState {
            category_files: Vec::new(),
            per_cat_len: Vec::new(),
            loaded: HashMap::new(),
        })
    })
}

async fn fetch_nano_banana_catalog_page(
    client: &Client,
    offset: usize,
    page_size: usize,
) -> Result<NanoBananaPageResult, String> {
    let mut st = nano_refs_mutex().lock().await;
    st.ensure_manifest(client).await?;
    let total = st.total();
    let items = st.fetch_page_slice(client, offset, page_size).await?;
    Ok(NanoBananaPageResult { items, total })
}

fn extract_image_urls(html: &str) -> Vec<String> {
    let html = html.replace("&amp;", "&");

    let og_re = Regex::new(r#"(?is)property=["']og:image["'][^>]*content=["']([^"']+)["']"#)
        .expect("valid og:image regex");

    let img_ext_re = Regex::new(
        r#"(?i)\b(?:https?:)?//[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?"#,
    )
    .expect("valid image extension regex");

    let mut seen = HashSet::<String>::new();
    let mut out = Vec::<String>::new();

    for cap in og_re.captures_iter(&html) {
        if let Some(m) = cap.get(1) {
            let u = m.as_str().to_string();
            if seen.insert(u.clone()) {
                out.push(u);
            }
        }
    }

    for m in img_ext_re.find_iter(&html) {
        let mut u = m.as_str().to_string();
        if u.starts_with("//") {
            u = format!("https:{}", u);
        }
        if seen.insert(u.clone()) {
            out.push(u);
        }
    }

    out
}

/// React Flight / RSC text chunks: `10:T414,<payload>` where 414 is payload length in hex.
fn parse_reve_rsc_string_table(text: &str) -> HashMap<String, String> {
    let re = Regex::new(r"(\d+):T([0-9a-fA-F]+),").expect("rsc table regex");
    let mut map = HashMap::new();
    for cap in re.captures_iter(text) {
        let id = cap[1].to_string();
        let Ok(len) = usize::from_str_radix(&cap[2], 16) else {
            continue;
        };
        let start = cap.get(0).map(|m| m.end()).unwrap_or(0);
        if start + len <= text.len() {
            map.insert(id, text[start..start + len].to_string());
        }
    }
    map
}

fn unescape_json_string_fragment(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match it.next() {
            Some('"') => out.push('"'),
            Some('\\') => out.push('\\'),
            Some('/') => out.push('/'),
            Some('n') => out.push('\n'),
            Some('r') => out.push('\r'),
            Some('t') => out.push('\t'),
            Some('u') => {
                let mut hex = String::new();
                for _ in 0..4 {
                    if let Some(h) = it.next() {
                        hex.push(h);
                    }
                }
                if let Ok(cp) = u32::from_str_radix(&hex, 16) {
                    if let Some(ch) = char::from_u32(cp) {
                        out.push(ch);
                    }
                }
            }
            Some(x) => {
                out.push('\\');
                out.push(x);
            }
            None => out.push('\\'),
        }
    }
    out
}

fn resolve_reve_caption(raw: &str, table: &HashMap<String, String>) -> String {
    let raw = raw.trim();
    if let Some(id) = raw.strip_prefix('$') {
        table.get(id).cloned().unwrap_or_default()
    } else {
        unescape_json_string_fragment(raw)
    }
}

/// Parses Next.js RSC flight response from revart.org/explore (images tab payload).
fn parse_reve_explore_rsc(text: &str, limit: usize) -> Vec<GalleryImage> {
    let table = parse_reve_rsc_string_table(text);
    let img_re = Regex::new(
        r#""caption":"(\$[0-9]+|(?:[^"\\]|\\.)*)","aspect_ratio":"[^"]+","image_url":"(https://cdn\.revart\.org/explore/[^"]+\.webp)""#,
    )
    .expect("reve image regex");

    let mut seen_src = HashSet::new();
    let mut out = Vec::new();

    for cap in img_re.captures_iter(text) {
        if out.len() >= limit {
            break;
        }
        let caption_raw = cap[1].to_string();
        let src = cap[2].to_string();
        if !seen_src.insert(src.clone()) {
            continue;
        }
        let prompt = resolve_reve_caption(&caption_raw, &table);
        out.push(GalleryImage {
            src,
            href: Some("https://revart.org/explore".to_string()),
            source: "reve".to_string(),
            title: None,
            prompt: Some(prompt),
        });
    }

    out
}

async fn fetch_reve_explore_gallery(client: &Client, limit: usize) -> Result<Vec<GalleryImage>, String> {
    let res = client
        .get("https://revart.org/explore")
        .header("RSC", "1")
        .header("Next-Url", "/explore")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Reve explore RSC HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let mut items = parse_reve_explore_rsc(&text, limit);
    if items.is_empty() {
        // Fallback: generic scrape (no prompts)
        let urls = extract_image_urls(&text);
        items = urls
            .into_iter()
            .take(limit)
            .map(|src| GalleryImage {
                src,
                href: Some("https://revart.org/explore".to_string()),
                source: "reve".to_string(),
                title: None,
                prompt: None,
            })
            .collect();
    }
    Ok(items)
}

const YOUMIND_NANO_FOOTER: &str =
    "</div></div><div class=\"absolute bottom-0 left-0 right-0 h-8 pointer-events-none";

fn youmind_html_to_prompt_plain(html: &str) -> String {
    let mut t = html
        .replace("</p>", "\n")
        .replace("</P>", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("<br />", "\n");
    let tag_re = Regex::new(r"(?s)<[^>]+>").expect("tag strip");
    t = tag_re.replace_all(&t, "").to_string();
    t = t
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&amp;", "&");
    t.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_youmind_card_prompt_html(card: &str) -> Option<&str> {
    let end = card.find(YOUMIND_NANO_FOOTER)?;
    let head = &card[..end];
    let key = "overflow-y-auto";
    let start = head.rfind(key)?;
    let tail = &head[start..];
    let gt = tail.find('>')?;
    Some(&tail[gt + 1..])
}

fn normalize_youmind_image_url(raw: &str) -> String {
    let raw = raw.trim();
    if raw.starts_with("//") {
        return format!("https:{raw}");
    }
    if raw.starts_with("/cdn-cgi/") {
        return format!("https://youmind.com{raw}");
    }
    raw.to_string()
}

/// Next/Image on YouMind often uses `src="/cdn-cgi/image/.../https%3A%2F%2Fcms-assets..."` with no direct gooo/CMS `src`.
fn first_youmind_card_image_url(card: &str) -> Option<String> {
    let gooo = Regex::new(
        r#"(?i)src="(https://cdn\.gooo\.ai/web-images/[a-f0-9]+(?:@[a-z0-9]+)?)"#,
    )
    .expect("youmind gooo img");
    if let Some(c) = gooo.captures(card) {
        return Some(c[1].to_string());
    }

    let cms = Regex::new(
        r#"(?i)src="(https://cms-assets\.youmind\.com/media/[^"]+\.(?:jpg|jpeg|png|webp))"#,
    )
    .expect("youmind cms img");
    if let Some(c) = cms.captures(card) {
        return Some(c[1].to_string());
    }

    let cdn_src = Regex::new(
        r#"(?i)src="((?:https://youmind\.com)?/cdn-cgi/image/[^"]+)"#,
    )
    .expect("youmind cdn-cgi src");
    if let Some(c) = cdn_src.captures(card) {
        return Some(normalize_youmind_image_url(&c[1]));
    }

    let srcset = Regex::new(r#"(?i)srcSet="([^"]+)"#).expect("youmind srcSet");
    let cap = srcset.captures(card)?;
    for part in cap[1].split(',') {
        let token = part.trim();
        let url = token.split_whitespace().next()?;
        if url.contains("/cdn-cgi/image/")
            || url.contains("cms-assets.youmind.com")
            || url.contains("cdn.gooo.ai")
        {
            return Some(normalize_youmind_image_url(url));
        }
    }

    None
}

/// SSR HTML from [YouMind Nano Banana Pro prompts](https://youmind.com/nano-banana-pro-prompts): `data-id` cards with `cdn-cgi/image/...` (CMS behind CF), `cdn.gooo.ai`, or direct CMS `src` / `srcSet`, plus prompt body before a fixed footer.
fn parse_youmind_nano_banana_html(html: &str, limit: usize) -> Vec<GalleryImage> {
    let limit = limit.max(1);
    let delim = r#"<div class="group relative flex flex-col mt-4" data-id=""#;
    let mut seen_id = HashSet::<String>::new();
    let mut out = Vec::new();

    for part in html.split(delim).skip(1) {
        if out.len() >= limit {
            break;
        }
        let Some(quote) = part.find('"') else {
            continue;
        };
        let id = part[..quote].trim().to_string();
        if id.is_empty() || !seen_id.insert(id.clone()) {
            continue;
        }
        let body = &part[quote + 2..];

        let Some(img_src) = first_youmind_card_image_url(body) else {
            continue;
        };
        let prompt_html = extract_youmind_card_prompt_html(body).unwrap_or("");
        let prompt = youmind_html_to_prompt_plain(prompt_html);
        if prompt.trim().len() < 12 {
            continue;
        }

        out.push(GalleryImage {
            src: img_src,
            href: Some(format!(
                "https://youmind.com/nano-banana-pro-prompts#prompt-{id}"
            )),
            source: "nanoBanana".to_string(),
            title: Some(format!("youmind-{id}")),
            prompt: Some(prompt),
        });
    }

    out
}

async fn fetch_youmind_nano_banana_gallery(client: &Client, limit: usize) -> Result<Vec<GalleryImage>, String> {
    let res = client
        .get("https://youmind.com/nano-banana-pro-prompts")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("YouMind Nano Banana HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let items = parse_youmind_nano_banana_html(&text, limit);
    if items.is_empty() {
        return Err(
            "Could not parse Nano Banana prompts from YouMind (page layout may have changed)."
                .to_string(),
        );
    }
    Ok(items)
}

#[tauri::command]
pub async fn fetch_gallery_images(
    source: String,
    limit: usize,
) -> Result<Vec<GalleryImage>, String> {
    let source = source.trim();
    let client = gallery_client()?;
    let limit = limit.max(1);
    match source {
        "reve" => fetch_reve_explore_gallery(&client, limit).await,
        "nanoBanana" => {
            let page = fetch_nano_banana_catalog_page(&client, 0, limit).await?;
            if page.items.is_empty() {
                fetch_youmind_nano_banana_gallery(&client, limit).await
            } else {
                Ok(page.items)
            }
        }
        _ => Err("unknown image source".to_string()),
    }
}

#[tauri::command]
pub async fn fetch_nano_banana_page(offset: usize, page_size: usize) -> Result<NanoBananaPageResult, String> {
    let client = gallery_client()?;
    fetch_nano_banana_catalog_page(&client, offset, page_size.max(1)).await
}

fn ext_from_content_type(ct: &str) -> &'static str {
    let ct = ct.split(';').next().unwrap_or(ct).trim().to_ascii_lowercase();
    if ct.contains("png") {
        return "png";
    }
    if ct.contains("webp") {
        return "webp";
    }
    if ct.contains("gif") {
        return "gif";
    }
    if ct.contains("jpeg") || ct.contains("jpg") {
        return "jpg";
    }
    "jpg"
}

fn ext_from_url_path(url: &str) -> Option<&'static str> {
    let path = url.rsplit('/').next()?.split('?').next()?;
    let ext = path.rsplit('.').next()?.to_ascii_lowercase();
    match ext.as_str() {
        "png" => Some("png"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "jpg" | "jpeg" => Some("jpg"),
        _ => None,
    }
}

/// Fetches image bytes over HTTP and saves into the user's Downloads folder (no CORS).
#[tauri::command]
pub async fn download_image_to_downloads(url: String) -> Result<String, String> {
    let download_dir = dirs::download_dir()
        .ok_or_else(|| "Could not resolve Downloads folder".to_string())?;

    let client = Client::builder()
        .user_agent("Athena/0.1.0 (+reqwest)")
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let ct = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let ext = ext_from_url_path(&url).unwrap_or_else(|| ext_from_content_type(ct));

    let base = format!("athena_image_{}", chrono::Utc::now().timestamp_millis());
    let mut path = download_dir.join(format!("{base}.{ext}"));
    let mut n = 0u32;
    while path.exists() {
        n += 1;
        path = download_dir.join(format!("{base}_{n}.{ext}"));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().into_owned())
}
