mod commands;
mod db;
mod inference;
mod models;
mod server;
mod state;
mod types;

use crate::db::Db;
use crate::inference::engine::InferenceEngine;
use crate::state::{InferenceHandle, StreamCancel};
use std::sync::Arc;
use tauri::Manager;

use commands::server::HttpServerCtl;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let home = dirs::home_dir()
                .map(|h| h.join(".athena"))
                .unwrap_or_else(|| std::path::PathBuf::from(".athena"));
            std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
            let db_path = db::default_db_path(&home);
            let conn = db::open(&db_path).map_err(|e| e.to_string())?;
            db::init_db(&conn).map_err(|e| e.to_string())?;
            let db = Db(Arc::new(std::sync::Mutex::new(conn)));
            let inference = InferenceHandle(Arc::new(InferenceEngine::new()));
            let cancel = StreamCancel::default();
            let http_ctl = HttpServerCtl::default();
            app.manage(db);
            app.manage(inference);
            app.manage(cancel);
            app.manage(http_ctl);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::attachments::analyze_audio_librosa,
            commands::chat::send_message,
            commands::chat::stream_chat,
            commands::chat::get_thread_messages,
            commands::chat::create_thread,
            commands::chat::delete_thread,
            commands::chat::delete_threads,
            commands::chat::rename_thread,
            commands::chat::list_threads,
            commands::chat::toggle_thread_pinned,
            commands::chat::set_thread_project,
            commands::chat::assign_threads_project,
            commands::chat::set_thread_color,
            commands::chat::set_threads_color,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::toggle_project_starred,
            commands::projects::toggle_project_pinned,
            commands::projects::delete_project,
            commands::chat::clear_thread_messages,
            commands::chat::clear_all_conversations,
            commands::chat::delete_last_assistant_message,
            commands::chat::delete_messages_from,
            commands::chat::delete_message,
            commands::chat::stop_streaming,
            commands::models::list_local_models,
            commands::models::download_model,
            commands::models::download_model_bundle,
            commands::models::delete_model,
            commands::models::get_model_info,
            commands::models::list_registry_models,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::import_profile_picture,
            commands::settings::open_models_dir,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::get_server_status,
            commands::security::set_app_pin,
            commands::security::clear_app_pin,
            commands::security::verify_app_pin,
            commands::security::has_app_pin,
            commands::hardware::get_hardware_snapshot,
            commands::inference::restart_inference_engine,
            commands::inference::preload_chat_model,
            commands::runtime::get_llama_runtime_info,
            commands::runtime::download_llama_runtime,
            commands::runtime::download_cudart_runtime,
            commands::images::fetch_gallery_images,
            commands::images::fetch_nano_banana_page,
            commands::images::download_image_to_downloads,
            commands::sora::fetch_sora_gallery_page,
            commands::sora::fetch_sora_prompt,
            commands::midjourney::fetch_midjourney_gallery_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Athena");
}
