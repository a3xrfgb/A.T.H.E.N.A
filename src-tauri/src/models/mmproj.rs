//! Resolves multimodal projector (`mmproj`) GGUF paths for vision-capable models.
//! Filenames align with `athena/src/constants/modelCatalog.ts` vision bundles.
//!
//! `llama-server` is started as `-m <main>.gguf --mmproj <mmproj>.gguf`; this module finds the mmproj path.
//! Bundle installs use `models/<main_id>/` for both main weights and mmproj.

use std::path::{Path, PathBuf};

/// Known main-weight `modelId` → mmproj filename in the models directory.
fn catalog_mmproj_filename(main_model_id: &str) -> Option<&'static str> {
    match main_model_id {
        "Qwen3.5-9B-Q4_K_M" => Some("mmproj-Qwen3.5-9B-BF16.gguf"),
        "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M" => {
            Some("mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf")
        }
        "gemma-4-E4B-it-Q4_K_M" => Some("mmproj-gemma-4-E4B-it-BF16.gguf"),
        "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M" => Some("gemma-4-E4B-it-mmproj-BF16.gguf"),
        "gemma-4-E2B-it-Q4_K_M" => Some("mmproj-gemma-4-E2B-it-BF16.gguf"),
        _ => None,
    }
}

const GEMMA_4_E4B_MMPROJ: &str = "mmproj-gemma-4-E4B-it-BF16.gguf";
const GEMMA_4_E2B_MMPROJ: &str = "mmproj-gemma-4-E2B-it-BF16.gguf";

fn norm_id(id: &str) -> String {
    id.to_lowercase().replace('_', "-")
}

/// Any Gemma 4 E4B IT main GGUF (any quant) uses the same BF16 mmproj from the catalog.
/// Excludes alternate forks (e.g. heretic uncensored) that ship a different `*-mmproj-*.gguf` name.
fn looks_like_gemma_4_e4b_it_main(main_model_id: &str) -> bool {
    let s = norm_id(main_model_id);
    if s.contains("ultra-uncensored-heretic") {
        return false;
    }
    s.contains("gemma-4-e4b-it") || (s.contains("gemma-4-e4b") && s.contains("it"))
}

/// Gemma 4 E2B IT (2B) — distinct mmproj from E4B; do not match `e4b` in the id.
fn looks_like_gemma_4_e2b_it_main(main_model_id: &str) -> bool {
    let s = norm_id(main_model_id);
    s.contains("gemma-4-e2b-it") || (s.contains("gemma-4-e2b") && s.contains("it"))
}

/// Stock Qwen3.5-9B weights (not HauhauCS Uncensored — that ID also contains `qwen3.5-9b` and needs a different mmproj).
fn looks_like_qwen35_9b_main(main_model_id: &str) -> bool {
    if looks_like_qwen35_uncensored_main(main_model_id) {
        return false;
    }
    let s = norm_id(main_model_id);
    s.contains("qwen3.5-9b") || s.contains("qwen3-5-9b")
}

fn looks_like_qwen35_uncensored_main(main_model_id: &str) -> bool {
    let s = norm_id(main_model_id);
    s.contains("uncensored") && s.contains("hauhaucs") && s.contains("qwen3.5")
}

fn dir_contains_main_weights(dir: &Path, main_model_id: &str) -> bool {
    for stem in crate::models::manager::model_id_fs_variants(main_model_id) {
        if dir.join(format!("{stem}.gguf")).is_file() {
            return true;
        }
    }
    false
}

fn push_mmproj_files_from_dir(dir: &Path, found: &mut Vec<PathBuf>) {
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let name = e.file_name();
            let s = name.to_string_lossy();
            if s.starts_with("mmproj-") && s.ends_with(".gguf") {
                found.push(e.path());
            }
        }
    }
}

/// Try `models/<mainVariant>/<mmproj>.gguf` and any `models/<slug>/` that contains the main GGUF.
fn try_mmproj_under_main_and_slug_dirs(
    models_dir: &Path,
    main_model_id: &str,
    mmproj_stem: &str,
) -> Option<PathBuf> {
    for m in crate::models::manager::model_id_fs_variants(main_model_id) {
        for fstem in crate::models::manager::model_id_fs_variants(mmproj_stem) {
            let p = models_dir.join(&m).join(format!("{fstem}.gguf"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    if let Ok(rd) = std::fs::read_dir(models_dir) {
        for e in rd.flatten() {
            let sub = e.path();
            if !sub.is_dir() {
                continue;
            }
            let dirname = sub.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if crate::models::manager::model_id_fs_variants(main_model_id)
                .iter()
                .any(|v| v.as_str() == dirname)
            {
                continue;
            }
            if !dir_contains_main_weights(&sub, main_model_id) {
                continue;
            }
            for fstem in crate::models::manager::model_id_fs_variants(mmproj_stem) {
                let p = sub.join(format!("{fstem}.gguf"));
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}

/// `mmproj-*.gguf` next to main weights: `models/<main_id>/`, catalog slug dirs, then flat `models/`.
fn list_mmproj_files(models_dir: &Path, main_model_id: &str) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    for m in crate::models::manager::model_id_fs_variants(main_model_id) {
        let sub = models_dir.join(&m);
        if sub.is_dir() {
            push_mmproj_files_from_dir(&sub, &mut found);
        }
    }
    if let Ok(rd) = std::fs::read_dir(models_dir) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() {
                continue;
            }
            let dirname = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if crate::models::manager::model_id_fs_variants(main_model_id)
                .iter()
                .any(|v| v.as_str() == dirname)
            {
                continue;
            }
            if dir_contains_main_weights(&p, main_model_id) {
                push_mmproj_files_from_dir(&p, &mut found);
            }
        }
    }
    if let Ok(rd) = std::fs::read_dir(models_dir) {
        for e in rd.flatten() {
            let name = e.file_name();
            let s = name.to_string_lossy();
            if s.starts_with("mmproj-") && s.ends_with(".gguf") {
                found.push(e.path());
            }
        }
    }
    found.sort();
    found
}

/// Pick the correct mmproj when one or more `mmproj-*.gguf` files exist.
fn pick_mmproj_for_main_model(models_dir: &Path, main_model_id: &str) -> Option<PathBuf> {
    let files = list_mmproj_files(models_dir, main_model_id);
    match files.len() {
        0 => None,
        // Do not bind a lone mmproj to arbitrary text-only GGUFs (e.g. Bonsai / Qwen3 8B next to a Gemma mmproj).
        1 => {
            if !(looks_like_gemma_4_e4b_it_main(main_model_id)
                || looks_like_gemma_4_e2b_it_main(main_model_id)
                || looks_like_qwen35_9b_main(main_model_id)
                || looks_like_qwen35_uncensored_main(main_model_id))
            {
                return None;
            }
            // Catalog vision bundles: require the on-disk mmproj to match the paired filename (avoids using
            // `mmproj-Qwen3.5-9B-BF16` with Uncensored main weights or vice versa — that mismatch yields HTTP 500 from llama-server on images).
            if let Some(expected) = catalog_mmproj_filename(main_model_id) {
                let expected_stem = expected.trim_end_matches(".gguf");
                let ok = files[0]
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| {
                        let stem = n.trim_end_matches(".gguf");
                        crate::models::manager::model_id_fs_variants(expected_stem)
                            .iter()
                            .any(|v| v.as_str() == stem)
                    })
                    .unwrap_or(false);
                return if ok { Some(files[0].clone()) } else { None };
            }
            Some(files[0].clone())
        }
        _ => {
            if looks_like_gemma_4_e4b_it_main(main_model_id) {
                let stem = GEMMA_4_E4B_MMPROJ.trim_end_matches(".gguf");
                if let Some(p) = try_mmproj_under_main_and_slug_dirs(models_dir, main_model_id, stem) {
                    return Some(p);
                }
                for fstem in crate::models::manager::model_id_fs_variants(stem) {
                    let p = models_dir.join(format!("{fstem}.gguf"));
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
            if looks_like_gemma_4_e2b_it_main(main_model_id) {
                let stem = GEMMA_4_E2B_MMPROJ.trim_end_matches(".gguf");
                if let Some(p) = try_mmproj_under_main_and_slug_dirs(models_dir, main_model_id, stem) {
                    return Some(p);
                }
                for fstem in crate::models::manager::model_id_fs_variants(stem) {
                    let p = models_dir.join(format!("{fstem}.gguf"));
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
            if looks_like_qwen35_uncensored_main(main_model_id) {
                let stem = "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16";
                if let Some(p) = try_mmproj_under_main_and_slug_dirs(models_dir, main_model_id, stem) {
                    return Some(p);
                }
                for fstem in crate::models::manager::model_id_fs_variants(stem) {
                    let p = models_dir.join(format!("{fstem}.gguf"));
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
            if looks_like_qwen35_9b_main(main_model_id) {
                let stem = "mmproj-Qwen3.5-9B-BF16";
                if let Some(p) = try_mmproj_under_main_and_slug_dirs(models_dir, main_model_id, stem) {
                    return Some(p);
                }
                for fstem in crate::models::manager::model_id_fs_variants(stem) {
                    let p = models_dir.join(format!("{fstem}.gguf"));
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
            None
        }
    }
}

/// Returns `Some(path)` when the mmproj file exists on disk.
pub fn resolve_mmproj_path(data_dir: &Path, main_model_id: &str) -> Result<Option<PathBuf>, String> {
    let dir = crate::models::manager::ensure_models_dir(data_dir).map_err(|e| e.to_string())?;

    if let Some(file) = catalog_mmproj_filename(main_model_id) {
        let stem = file.trim_end_matches(".gguf");
        if let Some(p) = try_mmproj_under_main_and_slug_dirs(&dir, main_model_id, stem) {
            return Ok(Some(p));
        }
        for fstem in crate::models::manager::model_id_fs_variants(stem) {
            let p = dir.join(format!("{fstem}.gguf"));
            if p.is_file() {
                return Ok(Some(p));
            }
        }
    }

    if looks_like_gemma_4_e4b_it_main(main_model_id) {
        let stem = GEMMA_4_E4B_MMPROJ.trim_end_matches(".gguf");
        if let Some(p) = try_mmproj_under_main_and_slug_dirs(&dir, main_model_id, stem) {
            return Ok(Some(p));
        }
        for fstem in crate::models::manager::model_id_fs_variants(stem) {
            let p = dir.join(format!("{fstem}.gguf"));
            if p.is_file() {
                return Ok(Some(p));
            }
        }
    }

    if looks_like_gemma_4_e2b_it_main(main_model_id) {
        let stem = GEMMA_4_E2B_MMPROJ.trim_end_matches(".gguf");
        if let Some(p) = try_mmproj_under_main_and_slug_dirs(&dir, main_model_id, stem) {
            return Ok(Some(p));
        }
        for fstem in crate::models::manager::model_id_fs_variants(stem) {
            let p = dir.join(format!("{fstem}.gguf"));
            if p.is_file() {
                return Ok(Some(p));
            }
        }
    }

    if let Some(p) = pick_mmproj_for_main_model(&dir, main_model_id) {
        return Ok(Some(p));
    }

    Ok(None)
}
