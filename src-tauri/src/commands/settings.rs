use crate::db::{self, Db};
use crate::types::AppSettings;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

/// Copy a user-picked image into `{data_dir}/profile/avatar.{ext}` for stable display via asset protocol.
#[tauri::command]
pub fn import_profile_picture(db: State<'_, Db>, source: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let base = PathBuf::from(&settings.data_dir);
    let profile_dir = base.join("profile");
    std::fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    let source_path = Path::new(&source);
    if !source_path.is_file() {
        return Err(format!("Not a file: {source}"));
    }
    let ext = source_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");
    let dest = profile_dir.join(format!("avatar.{ext}"));
    std::fs::copy(source_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_settings(db: State<'_, Db>) -> Result<AppSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::load_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(db: State<'_, Db>, settings: AppSettings) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::save_settings(&conn, &settings).map_err(|e| e.to_string())
}

/// Open the configured `data_dir/models` folder in the system file manager.
#[tauri::command]
pub fn open_models_dir(db: State<'_, Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let dir = crate::models::manager::ensure_models_dir(Path::new(&settings.data_dir))
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(dir.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(dir.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(dir.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        all(unix, not(target_os = "macos"))
    )))]
    {
        let _ = dir;
        return Err("Opening folders is not supported on this platform".into());
    }

    Ok(())
}
