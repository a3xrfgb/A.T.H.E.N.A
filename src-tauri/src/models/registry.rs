use crate::types::RegistryModel;
use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HfModelSummary {
    id: String,
}

/// Fetch GGUF-related model ids from Hugging Face Hub (metadata only; download uses a direct URL).
pub async fn fetch_hf_gguf_models() -> Result<Vec<RegistryModel>> {
    let url = "https://huggingface.co/api/models?search=gguf&sort=downloads&direction=-1&limit=25";
    let client = reqwest::Client::builder()
        .user_agent("Athena/0.1 (local)")
        .build()?;
    let res = client.get(url).send().await?;
    let models: Vec<HfModelSummary> = res.json().await?;
    let mut out: Vec<RegistryModel> = models
        .into_iter()
        .map(|m| {
            let short = m.id.split('/').next_back().unwrap_or(&m.id).to_string();
            RegistryModel {
                id: m.id.clone(),
                name: short.clone(),
                size_label: "—".into(),
                parameters: guess_params_from_name(&short),
                kind: "chat".into(),
                source: "HuggingFace".into(),
                download_url: None,
            }
        })
        .collect();
    if out.is_empty() {
        out = fallback_curated();
    }
    Ok(out)
}

fn guess_params_from_name(name: &str) -> String {
    let lower = name.to_lowercase();
    for pat in ["70b", "34b", "32b", "13b", "12b", "8b", "7b", "3b", "2b", "1b"] {
        if lower.contains(pat) {
            return pat.to_uppercase().replace('B', "B");
        }
    }
    "—".into()
}

fn fallback_curated() -> Vec<RegistryModel> {
    vec![RegistryModel {
        id: "athena.help/local-models".into(),
        name: "Add GGUF models to ~/.athena/models".into(),
        size_label: "—".into(),
        parameters: "—".into(),
        kind: "chat".into(),
        source: "local".into(),
        download_url: None,
    }]
}
