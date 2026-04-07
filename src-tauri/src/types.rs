use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Thread {
    pub id: String,
    pub title: String,
    pub model_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default = "default_thread_color")]
    pub color: String,
}

fn default_thread_color() -> String {
    "#64748b".into()
}

fn default_language() -> String {
    "en".into()
}
fn default_font_size_scale() -> f32 {
    1.0
}
fn default_font_weight_preset() -> String {
    "normal".into()
}
fn default_font_style() -> String {
    "inter".into()
}
fn default_thinking_style() -> String {
    "bubble".into()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    #[serde(default = "default_project_color")]
    pub color: String,
    #[serde(default)]
    pub folder_path: String,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub pinned: bool,
}

fn default_project_color() -> String {
    "#7c6af7".into()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub model_id: Option<String>,
    pub tokens_used: Option<i64>,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub size_bytes: u64,
    pub parameters: String,
    pub quantization: String,
    pub format: String,
    pub local_path: String,
    pub is_loaded: bool,
    /// From GGUF metadata (`*.context_length`), if present.
    #[serde(default)]
    pub max_context_tokens: Option<u32>,
    /// From GGUF (`*.block_count`), if present.
    #[serde(default)]
    pub layer_count: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub model_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub default_model: String,
    pub server_port: u16,
    pub server_enabled: bool,
    pub max_tokens: u32,
    pub temperature: f32,
    pub context_length: u32,
    pub gpu_layers: i32,
    pub data_dir: String,
    pub api_key: String,

    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub developer_mode: bool,
    #[serde(default = "default_font_size_scale")]
    pub font_size_scale: f32,
    #[serde(default = "default_font_weight_preset")]
    pub font_weight_preset: String,
    /// UI font when `language` is English (`inter`, `roboto`, …). Ignored for other languages.
    #[serde(default = "default_font_style")]
    pub font_style: String,
    #[serde(default = "default_thinking_style")]
    pub thinking_style: String,

    pub profile_picture_path: String,
    pub profile_full_name: String,
    #[serde(default)]
    pub profile_nickname: String,
    pub profile_occupation: String,
    pub profile_about_me: String,

    pub personal_custom_instructions: String,
    pub personal_nickname: String,
    pub personal_more_about_you: String,
    pub personal_memory_enabled: bool,
    pub personal_memory_blob: String,

    pub security_pin_hash: String,
    pub security_pin_salt: String,
    pub security_auto_lock_minutes: u32,

    /// `cpu` | `cuda12` | `vulkan` — used to pick the Windows release zip from ggml-org/llama.cpp.
    #[serde(default = "default_runtime_variant")]
    pub runtime_variant: String,
    #[serde(default = "default_true")]
    pub runtime_notify_updates: bool,

    /// Prepended into the system message (behavior / style). Empty = no extra block.
    #[serde(default)]
    pub system_prompt: String,

    /// CPU threads for llama-server (`-t`). `-1` = server default.
    #[serde(default = "default_inference_threads")]
    pub cpu_threads: i32,

    #[serde(default = "default_batch_size")]
    pub inference_batch_size: u32,
    #[serde(default = "default_ubatch_size")]
    pub inference_ubatch_size: u32,
    /// Server slots (`-np`). `-1` = auto.
    #[serde(default = "default_inference_parallel")]
    pub inference_parallel: i32,

    /// `auto` | `on` | `off` — passed to `-fa` when not `auto`.
    #[serde(default = "default_flash_attn")]
    pub inference_flash_attn: String,
    #[serde(default = "default_true")]
    pub inference_mmap: bool,
    #[serde(default)]
    pub inference_mlock: bool,
    #[serde(default = "default_true")]
    pub inference_kv_offload: bool,
    #[serde(default = "default_true")]
    pub inference_kv_unified: bool,

    /// `0` = do not override (model default).
    #[serde(default)]
    pub rope_freq_base: f32,
    #[serde(default)]
    pub rope_freq_scale: f32,
    #[serde(default = "default_inference_seed")]
    pub inference_seed: i64,

    /// Empty = server default. Otherwise `-ctk` / `-ctv` (e.g. `f16`, `q8_0`).
    #[serde(default)]
    pub inference_cache_type_k: String,
    #[serde(default)]
    pub inference_cache_type_v: String,

    /// UI: show advanced inference controls in Settings → General.
    #[serde(default)]
    pub show_advanced_inference: bool,

    #[serde(default = "default_true")]
    pub home_show_flip_clock: bool,
    #[serde(default = "default_true")]
    pub home_show_inspiration: bool,
    #[serde(default = "default_true")]
    pub home_show_stats: bool,
    #[serde(default)]
    pub home_compact_layout: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir()
            .map(|p| p.join(".athena").to_string_lossy().to_string())
            .unwrap_or_else(|| ".athena".to_string());
        Self {
            theme: "dark".into(),
            default_model: String::new(),
            server_port: 11434,
            server_enabled: false,
            max_tokens: 2048,
            temperature: 0.7,
            context_length: 4096,
            gpu_layers: -1,
            data_dir: home,
            api_key: String::new(),
            language: default_language(),
            developer_mode: false,
            font_size_scale: default_font_size_scale(),
            font_weight_preset: default_font_weight_preset(),
            font_style: default_font_style(),
            thinking_style: default_thinking_style(),
            profile_picture_path: String::new(),
            profile_full_name: String::new(),
            profile_nickname: String::new(),
            profile_occupation: String::new(),
            profile_about_me: String::new(),
            personal_custom_instructions: String::new(),
            personal_nickname: String::new(),
            personal_more_about_you: String::new(),
            personal_memory_enabled: false,
            personal_memory_blob: String::new(),
            security_pin_hash: String::new(),
            security_pin_salt: String::new(),
            security_auto_lock_minutes: 0,
            runtime_variant: default_runtime_variant(),
            runtime_notify_updates: default_true(),
            system_prompt: String::new(),
            cpu_threads: default_inference_threads(),
            inference_batch_size: default_batch_size(),
            inference_ubatch_size: default_ubatch_size(),
            inference_parallel: default_inference_parallel(),
            inference_flash_attn: default_flash_attn(),
            inference_mmap: true,
            inference_mlock: false,
            inference_kv_offload: true,
            inference_kv_unified: true,
            rope_freq_base: 0.0,
            rope_freq_scale: 0.0,
            inference_seed: default_inference_seed(),
            inference_cache_type_k: String::new(),
            inference_cache_type_v: String::new(),
            show_advanced_inference: false,
            home_show_flip_clock: true,
            home_show_inspiration: true,
            home_show_stats: true,
            home_compact_layout: false,
        }
    }
}

fn default_inference_threads() -> i32 {
    -1
}
fn default_batch_size() -> u32 {
    2048
}
fn default_ubatch_size() -> u32 {
    512
}
fn default_inference_parallel() -> i32 {
    -1
}
fn default_flash_attn() -> String {
    "auto".into()
}
fn default_inference_seed() -> i64 {
    -1
}

fn default_runtime_variant() -> String {
    "cpu".into()
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegistryModel {
    pub id: String,
    pub name: String,
    pub size_label: String,
    pub parameters: String,
    pub kind: String,
    pub source: String,
    pub download_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vram_total_bytes: Option<u64>,
    pub memory_used_bytes: Option<u64>,
    pub backend: String,
    pub device_index: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSnapshot {
    pub cpu_name: String,
    pub cpu_arch: String,
    pub cpu_features: Vec<String>,
    pub cpu_compatible: bool,
    pub ram_total_bytes: u64,
    pub ram_used_bytes: u64,
    pub vram_total_bytes: Option<u64>,
    pub cpu_usage_percent: f64,
    /// RAM used + GPU dedicated memory used (NVML), for a single gauge when available.
    pub combined_mem_used_gb: f64,
    pub gpus: Vec<GpuInfo>,
    pub gpu_summary: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GalleryImage {
    pub src: String,
    pub href: Option<String>,
    pub source: String,
    pub title: Option<String>,
    /// Full prompt when available (e.g. Reve Explore RSC payload).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SoraGalleryItem {
    pub image_url: String,
    pub prompt_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SoraPageResult {
    pub items: Vec<SoraGalleryItem>,
    pub total: usize,
}

/// Single image from [a3xrfgb/Midjourney_gallery](https://huggingface.co/datasets/a3xrfgb/Midjourney_gallery) (no prompts in dataset).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MidjourneyGalleryItem {
    pub image_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MidjourneyPageResult {
    pub items: Vec<MidjourneyGalleryItem>,
    pub total: usize,
}

/// Paged slice of the Nano Banana Pro catalog ([YouMind-OpenLab reference JSON](https://github.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill/tree/main/references)).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NanoBananaPageResult {
    pub items: Vec<GalleryImage>,
    pub total: usize,
}
