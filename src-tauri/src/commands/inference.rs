use crate::db::{self, Db};
use crate::models::{manager, mmproj};
use crate::state::InferenceHandle;
use std::path::Path;
use tauri::State;

/// Stop the running `llama-server` so the next request loads with updated Settings (context, GPU layers, threads, etc.).
#[tauri::command]
pub async fn restart_inference_engine(inference: State<'_, InferenceHandle>) -> Result<(), String> {
    inference
        .0
        .stop_llama_server()
        .await
        .map_err(|e| e.to_string())
}

/// Load the chosen GGUF into `llama-server` immediately (only one model is loaded at a time).
/// Used when the user picks a model in the chat composer so the next message does not pay cold-start latency.
#[tauri::command]
pub async fn preload_chat_model(
    db: State<'_, Db>,
    inference: State<'_, InferenceHandle>,
    model_id: String,
) -> Result<(), String> {
    let settings = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let dir = manager::ensure_models_dir(Path::new(&settings.data_dir)).map_err(|e| e.to_string())?;
    let path = manager::resolve_gguf_path(&dir, &model_id)
        .ok_or_else(|| format!("model file not found for id {}", model_id))?;
    let mmproj_path = mmproj::resolve_mmproj_path(Path::new(&settings.data_dir), &model_id)
        .map_err(|e| e.to_string())?;
    inference
        .0
        .ensure_llama_server(path.as_path(), mmproj_path.as_deref(), &settings)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
