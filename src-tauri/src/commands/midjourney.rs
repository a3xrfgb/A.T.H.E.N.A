//! Hugging Face dataset [a3xrfgb/Midjourney_gallery](https://huggingface.co/datasets/a3xrfgb/Midjourney_gallery) — images only.
use reqwest::Client;
use std::collections::HashSet;
use std::sync::OnceLock;
use tokio::sync::Mutex as TokioMutex;

use crate::types::{MidjourneyGalleryItem, MidjourneyPageResult};

const HF_DATASET: &str = "a3xrfgb/Midjourney_gallery";
const HF_RESOLVE_BASE: &str = "https://huggingface.co/datasets/a3xrfgb/Midjourney_gallery/resolve/main";

static MJV_CACHE: OnceLock<TokioMutex<Option<Vec<MidjourneyGalleryItem>>>> = OnceLock::new();

fn mjv_cache() -> &'static TokioMutex<Option<Vec<MidjourneyGalleryItem>>> {
    MJV_CACHE.get_or_init(|| TokioMutex::new(None))
}

fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Athena/0.1.0 (+reqwest; Midjourney gallery)")
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_all_images_from_hf() -> Result<Vec<MidjourneyGalleryItem>, String> {
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

    let exts = [".png", ".jpg", ".jpeg", ".jfif", ".webp"];
    let mut images: Vec<String> = paths
        .iter()
        .filter(|p| exts.iter().any(|e| p.to_lowercase().ends_with(e)))
        .cloned()
        .collect();
    images.sort();

    let mut seen_urls = HashSet::new();
    let mut out = Vec::new();
    for p in images {
        let image_url = format!("{}/{}", HF_RESOLVE_BASE, p);
        if seen_urls.insert(image_url.clone()) {
            out.push(MidjourneyGalleryItem { image_url });
        }
    }

    Ok(out)
}

async fn get_or_build_list() -> Result<Vec<MidjourneyGalleryItem>, String> {
    let m = mjv_cache();
    let mut guard = m.lock().await;
    if let Some(v) = guard.as_ref() {
        return Ok(v.clone());
    }
    let built = fetch_all_images_from_hf().await?;
    *guard = Some(built.clone());
    Ok(built)
}

/// Paged slice of the cached image list (built on first call from the HF tree).
#[tauri::command]
pub async fn fetch_midjourney_gallery_page(
    offset: usize,
    page_size: usize,
) -> Result<MidjourneyPageResult, String> {
    let all = get_or_build_list().await?;
    let total = all.len();
    if page_size == 0 {
        return Ok(MidjourneyPageResult {
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
    Ok(MidjourneyPageResult { items, total })
}
