use crate::models::gguf_meta;
use crate::types::AppSettings;
use anyhow::{anyhow, Context, Result};
use futures_util::StreamExt;
use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;

/// Fingerprint of llama-server CLI options — restart when this or model path changes.
pub fn inference_launch_snapshot(settings: &AppSettings) -> String {
    serde_json::json!({
        "ctx": settings.context_length,
        "ngl": settings.gpu_layers,
        "cpu_threads": settings.cpu_threads,
        "batch": settings.inference_batch_size,
        "ubatch": settings.inference_ubatch_size,
        "parallel": settings.inference_parallel,
        "fa": settings.inference_flash_attn,
        "mmap": settings.inference_mmap,
        "mlock": settings.inference_mlock,
        "kvo": settings.inference_kv_offload,
        "kvu": settings.inference_kv_unified,
        "rope_base": settings.rope_freq_base,
        "rope_scale": settings.rope_freq_scale,
        "seed": settings.inference_seed,
        "ctk": settings.inference_cache_type_k,
        "ctv": settings.inference_cache_type_v,
        "media_path_mmproj": settings.data_dir.clone(),
    })
    .to_string()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

/// Usage / finish metadata from chat completion (streaming or not).
#[derive(Default, Clone, Debug)]
pub struct StreamUsage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub finish_reason: Option<String>,
}

struct Inner {
    child: Option<Child>,
    base_url: Option<String>,
    active_model: Option<PathBuf>,
    /// When set, `llama-server` was started with `--mmproj` (vision / multimodal).
    active_mmproj: Option<PathBuf>,
    /// From GET `/v1/models` after load — must match `model` in `/v1/chat/completions` (LM Studio / OpenAI clients do the same).
    openai_model_id: Option<String>,
    /// Last successful `inference_launch_snapshot(settings)` so ctx/ngl/thread changes restart the server.
    active_launch_snapshot: Option<String>,
}

pub struct InferenceEngine {
    inner: Mutex<Inner>,
}

impl Default for InferenceEngine {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                child: None,
                base_url: None,
                active_model: None,
                active_mmproj: None,
                openai_model_id: None,
                active_launch_snapshot: None,
            }),
        }
    }
}

impl InferenceEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Path to `llama-server` if found (`ATHENA_LLAMA_SERVER`, `~/.athena/bin/`, or `PATH`).
    pub fn resolve_llama_server_binary() -> Option<PathBuf> {
        if let Ok(p) = std::env::var("ATHENA_LLAMA_SERVER") {
            let pb = PathBuf::from(&p);
            if pb.exists() {
                return Some(pb);
            }
        }
        if let Some(h) = dirs::home_dir() {
            for name in ["llama-server.exe", "llama-server"] {
                let cand = h.join(".athena").join("bin").join(name);
                if cand.exists() {
                    return Some(cand);
                }
            }
        }
        Some(PathBuf::from("llama-server"))
    }

    async fn kill_child(&self) -> Result<()> {
        let mut g = self.inner.lock().await;
        if let Some(mut c) = g.child.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
        g.base_url = None;
        g.active_model = None;
        g.active_mmproj = None;
        g.openai_model_id = None;
        g.active_launch_snapshot = None;
        Ok(())
    }

    /// Stop `llama-server` so the next chat loads with updated Settings (context, GPU layers, etc.).
    pub async fn stop_llama_server(&self) -> Result<()> {
        self.kill_child().await
    }

    /// Resolved id for OpenAI-compatible calls (same as LM Studio: use server's model id).
    pub async fn openai_model_id(&self) -> Option<String> {
        self.inner.lock().await.openai_model_id.clone()
    }

    async fn fetch_openai_model_id(&self, base: &str) -> Option<String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .ok()?;
        let url = format!("{}/v1/models", base.trim_end_matches('/'));
        let v: serde_json::Value = client.get(&url).send().await.ok()?.json().await.ok()?;
        v["data"]
            .as_array()?
            .first()?
            .get("id")?
            .as_str()
            .map(|s| s.to_string())
    }

    fn same_mmproj(a: Option<&Path>, b: &Option<PathBuf>) -> bool {
        match (a, b.as_ref()) {
            (None, None) => true,
            (Some(p), Some(q)) => p == q.as_path(),
            _ => false,
        }
    }

    /// Prism ML Bonsai / Q1_0_g128: stock ggml-org `llama-server` cannot load these GGUFs.
    fn enrich_llama_ready_error(model_path: &Path, e: anyhow::Error) -> anyhow::Error {
        let base = e.to_string();
        let lossy = model_path.to_string_lossy().to_ascii_lowercase();
        let prism_q1_in_file =
            gguf_meta::gguf_file_contains(model_path, b"Q1_0_g128", 16 * 1024 * 1024);
        let prism_name_hint = lossy.contains("bonsai") || lossy.contains("q1_0_g128");
        if prism_q1_in_file || prism_name_hint {
            return anyhow::anyhow!(
                "{}\n\nThis model uses Prism ML Q1_0_g128 (1-bit) weights. The standard ggml-org llama.cpp binary used by Athena cannot load this format. Build `llama-server` from https://github.com/PrismML-Eng/llama.cpp (CUDA or Metal), then set the environment variable ATHENA_LLAMA_SERVER to that executable’s full path (Windows: full path to llama-server.exe), or replace the file under ~/.athena/bin/. See: https://huggingface.co/prism-ml/Bonsai-8B-gguf",
                base
            );
        }
        e
    }

    /// Ensure `llama-server` is running for the given GGUF path; returns base URL e.g. `http://127.0.0.1:PORT`.
    /// Pass `mmproj_path` for vision models (Qwen3-VL, Gemma multimodal, etc.).
    pub async fn ensure_llama_server(
        &self,
        model_path: &Path,
        mmproj_path: Option<&Path>,
        settings: &AppSettings,
    ) -> Result<String> {
        let model_path = model_path.to_path_buf();
        let snap = inference_launch_snapshot(settings);
        {
            let g = self.inner.lock().await;
            if let (Some(url), Some(am), Some(ss)) =
                (&g.base_url, &g.active_model, &g.active_launch_snapshot)
            {
                if am == &model_path
                    && Self::same_mmproj(mmproj_path, &g.active_mmproj)
                    && ss == &snap
                {
                    return Ok(url.clone());
                }
            }
        }
        self.kill_child().await?;

        let bin = Self::resolve_llama_server_binary()
            .unwrap_or_else(|| PathBuf::from("llama-server"));

        let port = TcpListener::bind("127.0.0.1:0")?
            .local_addr()?
            .port();

        let fallback_id = model_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("model")
            .to_string();

        let ctx_size = settings.context_length;
        let gpu_layers = settings.gpu_layers;

        let mut cmd = Command::new(&bin);
        cmd.arg("-m").arg(&model_path);
        if let Some(mp) = mmproj_path {
            cmd.arg("--mmproj").arg(mp);
            // LM Studio / llama.cpp: multimodal `file://…` URLs (see --media-path). Avoids fragile huge `data:…;base64,…` in JSON.
            // https://github.com/ggml-org/llama.cpp/pull/17697
            let media_root = Path::new(&settings.data_dir).join("inference_media");
            let _ = std::fs::create_dir_all(&media_root);
            cmd.arg("--media-path").arg(&media_root);
        }
        cmd.arg("--host").arg("127.0.0.1");
        cmd.arg("--port").arg(port.to_string());
        // Stable API name (matches /v1/models and OpenAI-style clients).
        cmd.arg("-a").arg(&fallback_id);
        let ngl = if gpu_layers < 0 {
            "auto".to_string()
        } else {
            gpu_layers.to_string()
        };
        cmd.arg("-ngl").arg(&ngl);
        if ctx_size > 0 {
            cmd.arg("-c").arg(ctx_size.to_string());
        }

        if settings.cpu_threads >= 1 {
            cmd.arg("-t").arg(settings.cpu_threads.to_string());
        }
        if settings.inference_batch_size >= 32 {
            cmd.arg("-b").arg(settings.inference_batch_size.to_string());
        }
        if settings.inference_ubatch_size >= 32 {
            cmd.arg("-ub").arg(settings.inference_ubatch_size.to_string());
        }
        if settings.inference_parallel >= 1 {
            cmd.arg("-np").arg(settings.inference_parallel.to_string());
        }

        let fa = settings.inference_flash_attn.trim();
        if fa.eq_ignore_ascii_case("on") {
            cmd.arg("-fa").arg("on");
        } else if fa.eq_ignore_ascii_case("off") {
            cmd.arg("-fa").arg("off");
        }
        // "auto" or empty: rely on server default

        if !settings.inference_mmap {
            cmd.arg("--no-mmap");
        }
        if settings.inference_mlock {
            cmd.arg("--mlock");
        }
        if !settings.inference_kv_offload {
            cmd.arg("--no-kv-offload");
        }
        if !settings.inference_kv_unified {
            cmd.arg("--no-kv-unified");
        }

        if settings.rope_freq_base > 0.0 {
            cmd
                .arg("--rope-freq-base")
                .arg(settings.rope_freq_base.to_string());
        }
        if settings.rope_freq_scale > 0.0 {
            cmd
                .arg("--rope-freq-scale")
                .arg(settings.rope_freq_scale.to_string());
        }
        if settings.inference_seed >= 0 {
            cmd.arg("-s").arg(settings.inference_seed.to_string());
        }
        let ctk = settings.inference_cache_type_k.trim();
        if !ctk.is_empty() {
            cmd.arg("-ctk").arg(ctk);
        }
        let ctv = settings.inference_cache_type_v.trim();
        if !ctv.is_empty() {
            cmd.arg("-ctv").arg(ctv);
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        if let Some(home) = dirs::home_dir() {
            let log_dir = home.join(".athena").join("logs");
            if std::fs::create_dir_all(&log_dir).is_ok() {
                let log_path = log_dir.join("llama-server.log");
                if let Ok(f) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                {
                    cmd.stderr(Stdio::from(f));
                } else {
                    cmd.stderr(Stdio::null());
                }
            } else {
                cmd.stderr(Stdio::null());
            }
        } else {
            cmd.stderr(Stdio::null());
        }

        let child = cmd.spawn().with_context(|| {
            format!(
                "spawn llama-server (binary {:?}). Is llama.cpp on PATH?",
                bin
            )
        })?;

        let base = format!("http://127.0.0.1:{port}");
        let path_for_hint = model_path.clone();
        {
            let mut g = self.inner.lock().await;
            g.child = Some(child);
            g.base_url = Some(base.clone());
            g.active_model = Some(model_path);
            g.active_mmproj = mmproj_path.map(|p| p.to_path_buf());
            g.active_launch_snapshot = Some(snap);
        }

        self.wait_ready(&base).await.map_err(|e| {
            Self::enrich_llama_ready_error(&path_for_hint, e)
        })?;

        let oid = self
            .fetch_openai_model_id(&base)
            .await
            .unwrap_or(fallback_id);
        {
            let mut g = self.inner.lock().await;
            g.openai_model_id = Some(oid);
        }

        Ok(base)
    }

    async fn wait_ready(&self, base: &str) -> Result<()> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()?;
        // Prefer /v1/models with non-empty data — server can expose /health before weights are ready.
        for _ in 0..180u32 {
            let models_url = format!("{}/v1/models", base.trim_end_matches('/'));
            if let Ok(r) = client.get(&models_url).send().await {
                if r.status().is_success() {
                    if let Ok(v) = r.json::<serde_json::Value>().await {
                        if v["data"]
                            .as_array()
                            .map(|a| !a.is_empty())
                            .unwrap_or(false)
                        {
                            return Ok(());
                        }
                    }
                }
            }
            let health_url = format!("{}/health", base.trim_end_matches('/'));
            if let Ok(r) = client.get(&health_url).send().await {
                if r.status().is_success() {
                    return Ok(());
                }
            }
            if let Ok(r) = client.get(base).send().await {
                if r.status().is_success() {
                    return Ok(());
                }
            }
            sleep(Duration::from_millis(500)).await;
        }
        Err(anyhow!(
            "llama-server did not become ready in time. See ~/.athena/logs/llama-server.log and verify the GGUF path, VRAM, and llama.cpp build."
        ))
    }

    /// Qwen3 / DeepSeek-style: `reasoning_content` + `content` in message.
    pub fn extract_assistant_parts(v: &serde_json::Value) -> (String, String, Option<serde_json::Value>) {
        let usage = v.get("usage").cloned();
        let Some(choice0) = v["choices"].get(0) else {
            return (String::new(), String::new(), usage);
        };
        let msg = &choice0["message"];
        let thinking = msg["reasoning_content"]
            .as_str()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();
        let final_text = msg["content"]
            .as_str()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();
        (thinking, final_text, usage)
    }

    /// JSON stored in DB for assistant messages (parsed in UI). Falls back to plain text when no extras.
    pub fn assistant_blob_json(
        thinking: &str,
        final_text: &str,
        gen_ms: Option<u64>,
        usage: &StreamUsage,
    ) -> String {
        let tokens_per_sec = match (gen_ms, usage.completion_tokens) {
            (Some(ms), Some(ct)) if ms > 0 => {
                let sec = ms as f64 / 1000.0;
                if sec > 0.001 {
                    Some(ct as f64 / sec)
                } else {
                    None
                }
            }
            _ => None,
        };
        let thin = thinking.trim();
        let fin = final_text.trim();
        if thin.is_empty()
            && gen_ms.is_none()
            && usage.completion_tokens.is_none()
            && usage.prompt_tokens.is_none()
            && usage.finish_reason.is_none()
        {
            return fin.to_string();
        }
        json!({
            "v": 1,
            "thinking": thin,
            "final": fin,
            "genMs": gen_ms,
            "tokensPerSec": tokens_per_sec,
            "completionTokens": usage.completion_tokens,
            "promptTokens": usage.prompt_tokens,
            "finishReason": usage.finish_reason,
        })
        .to_string()
    }

    fn merge_stream_usage(acc: &mut StreamUsage, v: &serde_json::Value) {
        if let Some(u) = v.get("usage") {
            if let Some(n) = u["completion_tokens"].as_u64() {
                acc.completion_tokens = Some(n as u32);
            }
            if let Some(n) = u["prompt_tokens"].as_u64() {
                acc.prompt_tokens = Some(n as u32);
            }
        }
        if let Some(choice) = v["choices"].get(0) {
            if let Some(fr) = choice["finish_reason"].as_str() {
                if !fr.is_empty() {
                    acc.finish_reason = Some(fr.to_string());
                }
            }
        }
    }

    /// `native_thinking`: pass `true` when the composer Think bulb is on (Qwen3-style models).
    pub async fn chat_complete(
        &self,
        base: &str,
        messages: Vec<ChatMsg>,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value,
    ) -> Result<String> {
        let model = self
            .inner
            .lock()
            .await
            .openai_model_id
            .clone()
            .ok_or_else(|| anyhow!("no OpenAI model id; call ensure_llama_server first"))?;

        let client = reqwest::Client::new();
        let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false,
            "chat_template_kwargs": chat_template_kwargs,
        });
        let res = client
            .post(&url)
            .header(ACCEPT, "application/json")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {url}"))?;
        let status = res.status();
        if !status.is_success() {
            let t = res.text().await.unwrap_or_default();
            return Err(anyhow!("inference error {}: {}", status, t));
        }
        let v: serde_json::Value = res.json().await?;
        let (thinking, final_text, _) = Self::extract_assistant_parts(&v);
        let mut u = StreamUsage::default();
        Self::merge_stream_usage(&mut u, &v);
        let content = Self::assistant_blob_json(&thinking, &final_text, None, &u);
        Ok(content)
    }

    /// OpenAI-compatible streaming; `on_delta(text, is_reasoning)` — reasoning deltas first from many servers.
    /// `include_reasoning_stream`: set from the composer Think toggle. When `false`, `reasoning_content`
    /// chunks are ignored so they are not merged into the main answer (llama-server may still emit both
    /// `reasoning_content` and `content` for the same tokens — that produced duplicated/tripled text in the UI).
    pub async fn chat_complete_stream_json<F>(
        &self,
        base: &str,
        messages: serde_json::Value,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value,
        include_reasoning_stream: bool,
        mut on_delta: F,
    ) -> Result<StreamUsage>
    where
        F: FnMut(&str, bool) -> bool,
    {
        let model = self
            .inner
            .lock()
            .await
            .openai_model_id
            .clone()
            .ok_or_else(|| anyhow!("no OpenAI model id; call ensure_llama_server first"))?;

        let client = reqwest::Client::new();
        let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": true,
            "stream_options": { "include_usage": true },
            "chat_template_kwargs": chat_template_kwargs,
        });
        let res = client
            .post(&url)
            .header(ACCEPT, "text/event-stream")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST stream {url}"))?;
        if !res.status().is_success() {
            let t = res.text().await.unwrap_or_default();
            return Err(anyhow!("inference stream error: {}", t));
        }
        let mut stream = res.bytes_stream();
        let mut buf = Vec::new();
        let mut usage = StreamUsage::default();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            buf.extend_from_slice(&chunk);
            while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buf.drain(..=pos).collect();
                let line = String::from_utf8_lossy(&line);
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }
                let payload = line.strip_prefix("data: ").unwrap_or(line);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) {
                    Self::merge_stream_usage(&mut usage, &v);
                    if let Some(choice) = v["choices"].get(0) {
                        let delta = &choice["delta"];
                        let r = delta["reasoning_content"]
                            .as_str()
                            .filter(|s| !s.is_empty());
                        let c = delta["content"].as_str().filter(|s| !s.is_empty());

                        // Some Gemma / llama-server builds mirror the same incremental text in both
                        // `reasoning_content` and `content`. Emitting both produces WordWord-style
                        // duplication in the UI (and doubles the stored answer).
                        if include_reasoning_stream {
                            match (r, c) {
                                (Some(rv), Some(cv)) if rv == cv => {
                                    if !on_delta(cv, false) {
                                        return Ok(usage);
                                    }
                                }
                                _ => {
                                    if let Some(rv) = r {
                                        if !on_delta(rv, true) {
                                            return Ok(usage);
                                        }
                                    }
                                    if let Some(cv) = c {
                                        if r.map(|rv| rv != cv).unwrap_or(true) && !on_delta(cv, false) {
                                            return Ok(usage);
                                        }
                                    }
                                }
                            }
                        } else if let Some(cv) = c {
                            if !on_delta(cv, false) {
                                return Ok(usage);
                            }
                        } else if let Some(rv) = r {
                            // Think off: still forward reasoning-only chunks as the answer stream
                            // (some servers only populate reasoning_content for certain templates).
                            if !on_delta(rv, false) {
                                return Ok(usage);
                            }
                        }
                    }
                }
            }
        }
        Ok(usage)
    }

    pub async fn list_models_openai(&self, base: &str) -> Result<serde_json::Value> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;
        let url = format!("{}/v1/models", base.trim_end_matches('/'));
        let res = client.get(&url).send().await?;
        Ok(res.json().await?)
    }

    pub async fn active_model_path(&self) -> Option<PathBuf> {
        let g = self.inner.lock().await;
        g.active_model.clone()
    }
}
