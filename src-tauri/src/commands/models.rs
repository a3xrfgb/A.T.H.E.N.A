use crate::db::{self, Db};
use crate::models::manager;
use crate::models::registry;
use crate::state::InferenceHandle;
use crate::types::{DownloadProgress, ModelInfo};
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

fn models_dir_from_settings(settings: &crate::types::AppSettings) -> Result<PathBuf, String> {
    manager::ensure_models_dir(Path::new(&settings.data_dir)).map_err(|e| e.to_string())
}

async fn download_stream_to_file(
    app: &AppHandle,
    model_id: &str,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let client = reqwest::Client::new();
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    let total = res.content_length().unwrap_or(0);
    let mut stream = res.bytes_stream();
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let pct = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        let _ = app.emit(
            "athena-download-progress",
            json!(DownloadProgress {
                model_id: model_id.to_string(),
                bytes_downloaded: downloaded,
                total_bytes: total,
                percentage: pct,
                status: "downloading".into(),
            }),
        );
    }
    let _ = app.emit(
        "athena-download-progress",
        json!(DownloadProgress {
            model_id: model_id.to_string(),
            bytes_downloaded: downloaded,
            total_bytes: total,
            percentage: 100.0,
            status: "complete".into(),
        }),
    );
    Ok(())
}

#[tauri::command]
pub async fn list_local_models(
    db: State<'_, Db>,
    inference: State<'_, InferenceHandle>,
) -> Result<Vec<ModelInfo>, String> {
    let settings = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let dir = models_dir_from_settings(&settings)?;
    let active_s = inference
        .0
        .active_model_path()
        .await
        .map(|p| p.to_string_lossy().to_string());
    manager::scan_models(&dir, active_s.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    db: State<'_, Db>,
    model_id: String,
    url: String,
) -> Result<(), String> {
    let dest_dir = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
        models_dir_from_settings(&settings)?
    };
    let filename = format!("{}.gguf", sanitize_filename(&model_id));
    let dest = dest_dir.join(&filename);
    download_stream_to_file(&app, &model_id, &url, &dest).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFile {
    pub id: String,
    pub url: String,
}

/// Downloads main GGUF + mmproj (and any extra files) into `models/<bundle_subdir>/`.
#[tauri::command]
pub async fn download_model_bundle(
    app: AppHandle,
    db: State<'_, Db>,
    bundle_subdir: String,
    files: Vec<BundleFile>,
) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }
    let dest_root = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
        models_dir_from_settings(&settings)?
    };
    let folder = sanitize_filename(&bundle_subdir);
    let bundle_dir = dest_root.join(&folder);
    fs::create_dir_all(&bundle_dir).map_err(|e| e.to_string())?;

    for f in files {
        let name = format!("{}.gguf", sanitize_filename(&f.id));
        let dest = bundle_dir.join(&name);
        download_stream_to_file(&app, &f.id, &f.url, &dest).await?;
    }
    Ok(())
}

fn sanitize_filename(s: &str) -> String {
    // Keep `.` so `Qwen3.5-9B-…` matches catalog ids and `list_local_models` stems.
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[tauri::command]
pub fn delete_model(db: State<'_, Db>, model_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let dir = models_dir_from_settings(&settings)?;
    manager::delete_model_artifacts(&dir, &model_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_model_info(db: State<'_, Db>, model_id: String) -> Result<ModelInfo, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let dir = models_dir_from_settings(&settings)?;
    let list = manager::scan_models(&dir, None).map_err(|e| e.to_string())?;
    list.into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| "model not found".to_string())
}

#[tauri::command]
pub async fn list_registry_models() -> Result<Vec<crate::types::RegistryModel>, String> {
    registry::fetch_hf_gguf_models()
        .await
        .map_err(|e| e.to_string())
}
