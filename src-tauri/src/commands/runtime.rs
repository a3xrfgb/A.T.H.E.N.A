//! Download `llama-server` and companion DLLs from [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)
//! releases into `~/.athena/bin/`.
//!
//! Official Windows bundles (per release tag, e.g. b8665):
//! - CPU: `llama-<tag>-bin-win-cpu-x64.zip`
//! - Vulkan: `llama-<tag>-bin-win-vulkan-x64.zip`
//! - CUDA 12: `llama-<tag>-bin-win-cuda-12.4-x64.zip` **plus** `cudart-llama-bin-win-cuda-12.4-x64.zip`
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::json;
use std::fs::{self, File};
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const GITHUB_RELEASES_LATEST: &str =
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";
const VERSION_SIDECAR: &str = "llama-server.version";

#[derive(Deserialize, Clone)]
struct GhRelease {
    tag_name: String,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize, Clone)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

fn athena_bin_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".athena").join("bin"))
}

fn version_file_path() -> Option<PathBuf> {
    athena_bin_dir().map(|d| d.join(VERSION_SIDECAR))
}

fn read_installed_tag() -> Option<String> {
    let p = version_file_path()?;
    fs::read_to_string(&p)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn llama_server_exe_name() -> &'static str {
    if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    }
}

/// Strict match for the **main** engine zip (not cudart-only).
fn pick_main_engine_asset(assets: &[GhAsset], variant: &str) -> Option<usize> {
    let v = variant.to_lowercase();
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if !n.ends_with(".zip") || !n.starts_with("llama-") {
            continue;
        }
        let ok = match v.as_str() {
            "cpu" => n.contains("bin-win-cpu-x64") && !n.contains("arm64"),
            "vulkan" => n.contains("bin-win-vulkan-x64"),
            // Prefer exact 12.4 x64 bundle (same as upstream release layout).
            "cuda12" => n.contains("bin-win-cuda-12.4-x64"),
            _ => false,
        };
        if !ok {
            continue;
        }
        return Some(i);
    }
    // Fallback for cuda12: any llama `bin-win-cuda-12` that is not 13.x
    if v == "cuda12" {
        for (i, a) in assets.iter().enumerate() {
            let n = a.name.to_lowercase();
            if !n.ends_with(".zip") || !n.starts_with("llama-") {
                continue;
            }
            if n.contains("bin-win-cuda-12")
                && !n.contains("cuda-13")
                && !n.contains("13.1")
            {
                return Some(i);
            }
        }
    }
    None
}

/// `cudart-llama-bin-win-cuda-12.4-x64.zip` — CUDA runtime DLLs only.
fn pick_cudart_12_asset(assets: &[GhAsset]) -> Option<usize> {
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if !n.ends_with(".zip") {
            continue;
        }
        if n.starts_with("cudart-") && n.contains("bin-win-cuda-12.4-x64") {
            return Some(i);
        }
    }
    // looser: cudart + cuda-12 + win, not 13
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if n.starts_with("cudart-")
            && n.contains("bin-win")
            && n.contains("cuda-12")
            && !n.contains("cuda-13")
        {
            return Some(i);
        }
    }
    None
}

/// Extract entire zip into `dest_dir` (safe paths via `enclosed_name`).
fn extract_zip_all_to_dir<R: Read + Seek>(archive: &mut zip::ZipArchive<R>, dest_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name();
        if name.ends_with('/') {
            continue;
        }
        let rel = match file.enclosed_name() {
            Some(p) => p,
            None => continue,
        };
        let outpath = dest_dir.join(rel);
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn verify_llama_server_present(dest_dir: &Path) -> Result<(), String> {
    let exe = dest_dir.join(llama_server_exe_name());
    if exe.exists() {
        Ok(())
    } else {
        Err(format!(
            "{} not found after extraction. Check the release zip layout.",
            llama_server_exe_name()
        ))
    }
}

fn http_client_ua() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!(
            "Athena/",
            env!("CARGO_PKG_VERSION"),
            " (https://github.com/ggml-org/llama.cpp; llama-server installer)"
        ))
        .redirect(reqwest::redirect::Policy::limited(16))
        .build()
        .expect("reqwest client")
}

fn with_github_token(req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    match std::env::var("GITHUB_TOKEN") {
        Ok(tok) if !tok.is_empty() => req.header("Authorization", format!("Bearer {tok}")),
        _ => req,
    }
}

async fn http_error_body(res: reqwest::Response) -> String {
    let status = res.status();
    let bytes = res.bytes().await.unwrap_or_default();
    let snippet = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
    format!("HTTP {status} — {snippet}")
}

async fn fetch_latest_release() -> Result<GhRelease, String> {
    let client = http_client_ua();
    let res = with_github_token(
        client
            .get(GITHUB_RELEASES_LATEST)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28"),
    )
    .timeout(Duration::from_secs(45))
    .send()
    .await
    .map_err(|e| format!("GitHub API request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "GitHub API error: {}",
            http_error_body(res).await
        ));
    }
    res.json::<GhRelease>()
        .await
        .map_err(|e| format!("GitHub API JSON: {e}"))
}

#[cfg(target_os = "windows")]
async fn download_zip_to_path_emit(
    app: &AppHandle,
    client: &reqwest::Client,
    asset: &GhAsset,
    tmp_path: &Path,
    downloaded_global: &mut u64,
    total_plan: u64,
) -> Result<(), String> {
    let res = client
        .get(&asset.browser_download_url)
        .header("Accept", "application/octet-stream")
        .timeout(Duration::from_secs(900))
        .send()
        .await
        .map_err(|e| format!("Download {} failed: {e}", asset.name))?;
    if !res.status().is_success() {
        return Err(format!(
            "Download {}: {}",
            asset.name,
            http_error_body(res).await
        ));
    }
    let mut stream = res.bytes_stream();
    let mut file = tokio::fs::File::create(tmp_path)
        .await
        .map_err(|e| format!("temp file {}: {e}", tmp_path.display()))?;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk)
            .await
            .map_err(|e| e.to_string())?;
        *downloaded_global += chunk.len() as u64;
        let pct = if total_plan > 0 {
            (*downloaded_global as f64 / total_plan as f64) * 100.0
        } else {
            0.0
        };
        let _ = app.emit(
            "athena-runtime-download",
            json!({
                "bytesDownloaded": *downloaded_global,
                "totalBytes": total_plan,
                "percentage": pct.min(99.9),
                "status": "downloading",
                "phase": asset.name,
            }),
        );
    }
    file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Latest release info + matched main/cudart assets (Windows).
#[tauri::command]
pub async fn get_llama_runtime_info(variant: String) -> Result<serde_json::Value, String> {
    let rel = fetch_latest_release().await?;
    let installed = read_installed_tag();
    #[cfg(target_os = "windows")]
    {
        let main_idx = pick_main_engine_asset(&rel.assets, &variant);
        let main = main_idx.and_then(|i| rel.assets.get(i));
        let cudart_idx = pick_cudart_12_asset(&rel.assets);
        let cudart = cudart_idx.and_then(|i| rel.assets.get(i));
        let update_available = match (&installed, &rel.tag_name) {
            (Some(ins), latest) => ins != latest,
            (None, _) => true,
        };
        return Ok(json!({
            "latestTag": rel.tag_name,
            "installedTag": installed,
            "updateAvailable": update_available,
            "assetName": main.map(|a| a.name.clone()),
            "assetUrl": main.map(|a| a.browser_download_url.clone()),
            "assetSize": main.map(|a| a.size),
            "cudartAssetName": cudart.map(|a| a.name.clone()),
            "cudartUrl": cudart.map(|a| a.browser_download_url.clone()),
            "cudartSize": cudart.map(|a| a.size),
            "binDir": athena_bin_dir().map(|p| p.to_string_lossy().to_string()),
            "supported": true,
        }));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = variant;
        Ok(json!({
            "latestTag": rel.tag_name,
            "installedTag": installed,
            "updateAvailable": true,
            "assetName": serde_json::Value::Null,
            "assetUrl": serde_json::Value::Null,
            "assetSize": serde_json::Value::Null,
            "cudartAssetName": serde_json::Value::Null,
            "cudartUrl": serde_json::Value::Null,
            "cudartSize": serde_json::Value::Null,
            "binDir": athena_bin_dir().map(|p| p.to_string_lossy().to_string()),
            "supported": false,
        }))
    }
}

/// Download only the CUDA runtime DLL zip (cudart) into `~/.athena/bin/`.
#[tauri::command]
pub async fn download_cudart_runtime(app: AppHandle) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        return Err("cudart download is Windows-only.".into());
    }
    #[cfg(target_os = "windows")]
    {
        let rel = fetch_latest_release().await?;
        let idx = pick_cudart_12_asset(&rel.assets)
            .ok_or_else(|| "No cudart zip (cuda-12.4 x64) in this release.".to_string())?;
        let asset = rel.assets.get(idx).ok_or_else(|| "asset".to_string())?;
        let bin_dir = athena_bin_dir().ok_or_else(|| "no home dir".to_string())?;
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
        let total_plan = asset.size.max(1);
        let mut downloaded_global: u64 = 0;
        let tmp_path = std::env::temp_dir().join(format!(
            "athena-cudart-{}.zip",
            uuid::Uuid::new_v4()
        ));
        let client = http_client_ua();
        download_zip_to_path_emit(
            &app,
            &client,
            asset,
            &tmp_path,
            &mut downloaded_global,
            total_plan,
        )
        .await?;
        let f = File::open(&tmp_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("open zip: {e}"))?;
        extract_zip_all_to_dir(&mut archive, &bin_dir)?;
        let _ = fs::remove_file(&tmp_path);
        let _ = app.emit(
            "athena-runtime-download",
            json!({
                "bytesDownloaded": downloaded_global,
                "totalBytes": total_plan,
                "percentage": 100.0,
                "status": "complete",
                "phase": "cudart",
            }),
        );
        Ok(())
    }
}

/// Download selected variant: full extract to bin. CUDA 12 downloads **cudart first**, then main engine zip.
#[tauri::command]
pub async fn download_llama_runtime(app: AppHandle, variant: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = variant;
        return Err("Automated llama-server download is only implemented for Windows in this build.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let rel = fetch_latest_release().await?;
        let main_idx = pick_main_engine_asset(&rel.assets, &variant).ok_or_else(|| {
            format!(
                "No matching main bundle for {:?}. Expected e.g. llama-<tag>-bin-win-cpu-x64.zip, llama-<tag>-bin-win-cuda-12.4-x64.zip, or llama-<tag>-bin-win-vulkan-x64.zip.",
                variant
            )
        })?;
        let main_asset = rel.assets.get(main_idx).ok_or_else(|| "main asset".to_string())?;

        let cudart_asset: Option<&GhAsset> = if variant.eq_ignore_ascii_case("cuda12") {
            let idx = pick_cudart_12_asset(&rel.assets).ok_or_else(|| {
                "Release is missing cudart-llama-bin-win-cuda-12.4-x64.zip; CUDA 12 needs both cudart and the main llama CUDA bundle.".to_string()
            })?;
            Some(rel.assets.get(idx).ok_or_else(|| "cudart asset".to_string())?)
        } else {
            None
        };

        let bin_dir = athena_bin_dir().ok_or_else(|| "no home dir".to_string())?;
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

        let total_plan = match cudart_asset {
            Some(c) => c.size.saturating_add(main_asset.size).max(1),
            None => main_asset.size.max(1),
        };
        let mut downloaded_global: u64 = 0;
        let client = http_client_ua();

        if let Some(cuda_rt) = cudart_asset {
            let tmp_cudart = std::env::temp_dir().join(format!(
                "athena-cudart-{}.zip",
                uuid::Uuid::new_v4()
            ));
            download_zip_to_path_emit(
                &app,
                &client,
                cuda_rt,
                &tmp_cudart,
                &mut downloaded_global,
                total_plan,
            )
            .await?;
            let f = File::open(&tmp_cudart).map_err(|e| e.to_string())?;
            let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("cudart zip: {e}"))?;
            extract_zip_all_to_dir(&mut archive, &bin_dir)?;
            let _ = fs::remove_file(&tmp_cudart);
        }

        let tmp_main = std::env::temp_dir().join(format!(
            "athena-llama-runtime-{}.zip",
            uuid::Uuid::new_v4()
        ));
        download_zip_to_path_emit(
            &app,
            &client,
            main_asset,
            &tmp_main,
            &mut downloaded_global,
            total_plan,
        )
        .await?;

        let f = File::open(&tmp_main).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("main zip: {e}"))?;
        extract_zip_all_to_dir(&mut archive, &bin_dir)?;
        let _ = fs::remove_file(&tmp_main);

        verify_llama_server_present(&bin_dir)?;

        let vf = bin_dir.join(VERSION_SIDECAR);
        fs::write(&vf, rel.tag_name.as_bytes()).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "athena-runtime-download",
            json!({
                "bytesDownloaded": downloaded_global,
                "totalBytes": total_plan,
                "percentage": 100.0,
                "status": "complete",
                "phase": "done",
            }),
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn a(name: &str, size: u64) -> GhAsset {
        GhAsset {
            name: name.into(),
            browser_download_url: format!("https://example.com/{name}"),
            size,
        }
    }

    #[test]
    fn picks_exact_cpu_vulkan_cuda_cudart() {
        let assets = vec![
            a("cudart-llama-bin-win-cuda-12.4-x64.zip", 1),
            a("cudart-llama-bin-win-cuda-13.1-x64.zip", 1),
            a("llama-b8665-bin-win-cpu-arm64.zip", 1),
            a("llama-b8665-bin-win-cpu-x64.zip", 100),
            a("llama-b8665-bin-win-vulkan-x64.zip", 200),
            a("llama-b8665-bin-win-cuda-12.4-x64.zip", 300),
            a("llama-b8665-bin-win-cuda-13.1-x64.zip", 400),
        ];
        assert_eq!(
            pick_main_engine_asset(&assets, "cpu").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-cpu-x64.zip")
        );
        assert_eq!(
            pick_main_engine_asset(&assets, "vulkan").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-vulkan-x64.zip")
        );
        assert_eq!(
            pick_main_engine_asset(&assets, "cuda12").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-cuda-12.4-x64.zip")
        );
        assert_eq!(
            pick_cudart_12_asset(&assets).map(|i| assets[i].name.as_str()),
            Some("cudart-llama-bin-win-cuda-12.4-x64.zip")
        );
    }
}
