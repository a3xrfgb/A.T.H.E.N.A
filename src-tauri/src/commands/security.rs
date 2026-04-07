use crate::db::{self, Db};
use sha2::{Digest, Sha256};
use tauri::State;

fn hash_pin(pin: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(pin.as_bytes());
    hex::encode(hasher.finalize())
}

fn valid_pin(pin: &str) -> bool {
    let len = pin.len();
    if !(4..=6).contains(&len) {
        return false;
    }
    pin.chars().all(|c| c.is_ascii_digit())
}

#[tauri::command]
pub fn set_app_pin(db: State<'_, Db>, pin: String) -> Result<(), String> {
    if !valid_pin(&pin) {
        return Err("PIN must be 4–6 digits".into());
    }
    let salt = uuid::Uuid::new_v4().to_string();
    let hash = hash_pin(&pin, &salt);
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    settings.security_pin_hash = hash;
    settings.security_pin_salt = salt;
    db::save_settings(&conn, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_app_pin(db: State<'_, Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    settings.security_pin_hash.clear();
    settings.security_pin_salt.clear();
    db::save_settings(&conn, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn verify_app_pin(db: State<'_, Db>, pin: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    if settings.security_pin_hash.is_empty() {
        return Ok(false);
    }
    if !valid_pin(&pin) {
        return Ok(false);
    }
    let h = hash_pin(&pin, &settings.security_pin_salt);
    Ok(h == settings.security_pin_hash)
}

#[tauri::command]
pub fn has_app_pin(db: State<'_, Db>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    Ok(!settings.security_pin_hash.is_empty())
}
