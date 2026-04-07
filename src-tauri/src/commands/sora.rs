//! Hugging Face dataset [a3xrfgb/gpt-image-mega-4k](https://huggingface.co/datasets/a3xrfgb/gpt-image-mega-4k) — image + prompt pairs.
use reqwest::Client;
use std::collections::HashSet;
use std::sync::OnceLock;
use tokio::sync::Mutex as TokioMutex;

use crate::types::{SoraGalleryItem, SoraPageResult};

const HF_DATASET: &str = "a3xrfgb/gpt-image-mega-4k";
const HF_RESOLVE_BASE: &str =
    "https://huggingface.co/datasets/a3xrfgb/gpt-image-mega-4k/resolve/main";

static SORA_PAIRS_CACHE: OnceLock<TokioMutex<Option<Vec<SoraGalleryItem>>>> = OnceLock::new();

fn sora_cache() -> &'static TokioMutex<Option<Vec<SoraGalleryItem>>> {
    SORA_PAIRS_CACHE.get_or_init(|| TokioMutex::new(None))
}

fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Athena/0.1.0 (+reqwest; Sora gallery)")
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_all_pairs_from_hf() -> Result<Vec<SoraGalleryItem>, String> {
    let url = format!(
        "https://huggingface.co/api/datasets/{}/tree/main?recursive=1",
        HF_DATASET
    );

    let client = client()?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!(
            "Hugging Face tree HTTP {} — try again later or check your connection.",
            res.status()
        ));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let arr = body
        .as_array()
        .ok_or_else(|| "Unexpected Hugging Face API response (expected JSON array).".to_string())?;

    let mut paths = HashSet::new();
    for v in arr {
        if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
            paths.insert(p.to_string());
        }
    }

    let mut pngs: Vec<String> = paths
        .iter()
        .filter(|p| p.ends_with(".png"))
        .cloned()
        .collect();
    pngs.sort();

    let mut out = Vec::new();
    for png in pngs {
        let Some(stem) = png.strip_suffix(".png") else {
            continue;
        };
        let txt = format!("{}.txt", stem);
        if !paths.contains(&txt) {
            continue;
        }
        out.push(SoraGalleryItem {
            image_url: format!("{}/{}", HF_RESOLVE_BASE, png),
            prompt_url: format!("{}/{}", HF_RESOLVE_BASE, txt),
        });
    }

    // Tree can list the same path more than once; keep first occurrence per image URL.
    let mut seen_urls = HashSet::new();
    out.retain(|item| seen_urls.insert(item.image_url.clone()));

    Ok(out)
}

async fn get_or_build_pairs() -> Result<Vec<SoraGalleryItem>, String> {
    let m = sora_cache();
    let mut guard = m.lock().await;
    if let Some(v) = guard.as_ref() {
        return Ok(v.clone());
    }
    let built = fetch_all_pairs_from_hf().await?;
    *guard = Some(built.clone());
    Ok(built)
}

/// Paged slice of the full cached pair list (built on first call from the HF tree).
#[tauri::command]
pub async fn fetch_sora_gallery_page(offset: usize, page_size: usize) -> Result<SoraPageResult, String> {
    let all = get_or_build_pairs().await?;
    let total = all.len();
    if page_size == 0 {
        return Ok(SoraPageResult {
            items: vec![],
            total,
        });
    }
    let end = (offset + page_size).min(total);
    let items = if offset < total {
        all[offset..end].to_vec()
    } else {
        vec![]
    };
    Ok(SoraPageResult { items, total })
}

/// Fetches the plain-text prompt file (UTF-8).
#[tauri::command]
pub async fn fetch_sora_prompt(prompt_url: String) -> Result<String, String> {
    let client = client()?;
    let res = client
        .get(&prompt_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    res.text().await.map_err(|e| e.to_string())
}
