use base64::Engine;
use serde_json::Value;
use std::path::Path;
use std::process::Command;

fn run_librosa_script(script: &Path, tmp: &Path) -> Option<std::process::Output> {
    Command::new("python")
        .arg(script)
        .arg(tmp)
        .output()
        .ok()
        .or_else(|| Command::new("py").arg("-3").arg(script).arg(tmp).output().ok())
}

/// Runs `scripts/audio_librosa_summary.py` with Python when available.
/// Returns `None` if Python/librosa fails (caller keeps plain attachment text).
#[tauri::command]
pub fn analyze_audio_librosa(file_base64: String, file_name: String) -> Result<Option<String>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(file_base64.trim())
        .map_err(|e| e.to_string())?;
    let ext = Path::new(&file_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("wav");

    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/audio_librosa_summary.py");
    if !script.exists() {
        return Ok(None);
    }

    let tmp = std::env::temp_dir().join(format!(
        "athena_librosa_{}.{}",
        uuid::Uuid::new_v4(),
        ext
    ));
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;

    let output = run_librosa_script(&script, &tmp);
    let _ = std::fs::remove_file(&tmp);

    let out = match output {
        Some(o) => o,
        None => return Ok(None),
    };

    if !out.status.success() {
        return Ok(None);
    }

    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let v: Value = match serde_json::from_str(&s) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };
    if v.get("ok").and_then(|x| x.as_bool()) != Some(true) {
        return Ok(None);
    }
    Ok(v.get("summary")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string()))
}
