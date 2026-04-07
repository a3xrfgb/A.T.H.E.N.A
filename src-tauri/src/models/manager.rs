use crate::models::gguf_meta;
use crate::types::ModelInfo;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

fn guess_params(name: &str) -> String {
    let lower = name.to_lowercase();
    for pat in ["70b", "34b", "32b", "14b", "13b", "12b", "9b", "8b", "7b", "3b", "2b", "1b"] {
        if lower.contains(pat) {
            return pat.to_uppercase().replace('B', "B");
        }
    }
    "—".into()
}

/// Legacy GPT-OSS weights are no longer supported in Athena — hide from scans and UI.
fn is_legacy_gpt_oss_excluded(id: &str) -> bool {
    let norm: String = id
        .to_lowercase()
        .chars()
        .map(|c| match c {
            '.' | '-' => '_',
            c => c,
        })
        .collect();
    norm.contains("gpt_oss")
}

fn guess_quant(name: &str) -> String {
    let upper = name.to_uppercase();
    for q in [
        "Q8_0", "Q6_K", "Q5_K_M", "Q5_K_S", "Q5_0", "Q4_K_M", "Q4_K_S", "Q4_0", "Q3_K_M",
        "Q3_K_S", "Q2_K", "IQ4_NL", "F16", "F32",
    ] {
        if upper.contains(q) {
            return q.into();
        }
    }
    "GGUF".into()
}

/// Dotted vs underscored stems (legacy bundles saved when `.` was stripped from filenames).
/// Hyphens become underscores so catalog ids match on-disk GGUF names.
pub fn model_id_fs_variants(model_id: &str) -> Vec<String> {
    let mut out = Vec::new();
    let all_underscore = model_id.replace(['.', '-'], "_");
    for cand in [model_id.to_string(), all_underscore] {
        if !out.iter().any(|s| s == &cand) {
            out.push(cand);
        }
    }
    out
}

fn file_stem_matches_model_id(stem: &str, model_id: &str) -> bool {
    model_id_fs_variants(model_id)
        .iter()
        .any(|v| v.as_str() == stem)
}

/// `models/<id>.gguf` or any `models/<bundleDir>/<id>.gguf` (catalog bundle folders).
pub fn resolve_gguf_path(models_dir: &Path, model_id: &str) -> Option<PathBuf> {
    for stem in model_id_fs_variants(model_id) {
        let flat = models_dir.join(format!("{stem}.gguf"));
        if flat.is_file() {
            return Some(flat);
        }
    }
    if let Ok(rd) = fs::read_dir(models_dir) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() {
                continue;
            }
            for stem in model_id_fs_variants(model_id) {
                let cand = p.join(format!("{stem}.gguf"));
                if cand.is_file() {
                    return Some(cand);
                }
            }
        }
    }
    None
}

fn collect_gguf_paths(models_dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    if !models_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(models_dir).with_context(|| format!("read_dir {:?}", models_dir))? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            for e2 in fs::read_dir(&path).with_context(|| format!("read_dir {:?}", path))? {
                let e2 = e2?;
                let p2 = e2.path();
                if p2.extension().map(|e| e == "gguf").unwrap_or(false) {
                    out.push(p2);
                }
            }
        } else if path.extension().map(|e| e == "gguf").unwrap_or(false) {
            out.push(path);
        }
    }
    Ok(())
}

pub fn scan_models(models_dir: &Path, active_path: Option<&str>) -> Result<Vec<ModelInfo>> {
    if !models_dir.exists() {
        fs::create_dir_all(models_dir).with_context(|| format!("mkdir {:?}", models_dir))?;
        return Ok(vec![]);
    }
    let mut paths: Vec<PathBuf> = Vec::new();
    collect_gguf_paths(models_dir, &mut paths)?;
    paths.sort_by(|a, b| {
        a.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .cmp(b.file_name().and_then(|n| n.to_str()).unwrap_or(""))
    });

    let mut out = Vec::new();
    for path in paths {
        let meta = fs::metadata(&path)?;
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("model.gguf")
            .to_string();
        let id = filename.trim_end_matches(".gguf").to_string();
        if is_legacy_gpt_oss_excluded(&id) {
            continue;
        }
        let name = id.clone();
        let local_path = path.to_string_lossy().to_string();
        let is_loaded = active_path.map(|a| a == local_path.as_str()).unwrap_or(false);
        let params = guess_params(&filename);
        let quant = guess_quant(&filename);
        let gm = gguf_meta::read_gguf_meta(&path, 16 * 1024 * 1024);
        out.push(ModelInfo {
            id: id.clone(),
            name,
            filename,
            size_bytes: meta.len(),
            parameters: params,
            quantization: quant,
            format: "GGUF".into(),
            local_path,
            is_loaded,
            max_context_tokens: gm.max_context_tokens,
            layer_count: gm.layer_count,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn ensure_models_dir(base: &Path) -> Result<PathBuf> {
    let p = base.join("models");
    if !p.exists() {
        fs::create_dir_all(&p)?;
    }
    Ok(p)
}

/// Removes a GGUF. Deleting **main** weights inside a bundle subfolder drops the whole folder (main + mmproj).
pub fn delete_model_artifacts(models_dir: &Path, model_id: &str) -> Result<()> {
    let Some(path) = resolve_gguf_path(models_dir, model_id) else {
        return Ok(());
    };
    if let Some(parent) = path.parent() {
        if parent != models_dir {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if file_stem_matches_model_id(stem, model_id) && !model_id.starts_with("mmproj-") {
                return fs::remove_dir_all(parent).with_context(|| format!("remove_dir {:?}", parent));
            }
        }
    }
    fs::remove_file(&path).with_context(|| format!("remove {:?}", path))?;
    Ok(())
}
