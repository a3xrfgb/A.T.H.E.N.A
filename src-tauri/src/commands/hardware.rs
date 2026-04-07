use crate::types::{GpuInfo, HardwareSnapshot};
use nvml_wrapper::Nvml;
use serde_json::Value;
use std::process::Command;
use std::time::Duration;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

fn cpu_feature_tags() -> Vec<String> {
    let mut tags = Vec::new();
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        if std::is_x86_feature_detected!("avx") {
            tags.push("AVX".into());
        }
        if std::is_x86_feature_detected!("avx2") {
            tags.push("AVX2".into());
        }
        if std::is_x86_feature_detected!("fma") {
            tags.push("FMA".into());
        }
    }
    tags
}

fn cpu_compatible() -> bool {
    #[cfg(target_arch = "aarch64")]
    {
        return true;
    }
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        return std::is_x86_feature_detected!("avx");
    }
    #[allow(unreachable_code)]
    true
}

fn try_nvml_gpus() -> Option<(Vec<GpuInfo>, u64, u64)> {
    let nvml = Nvml::init().ok()?;
    let n = nvml.device_count().ok()?;
    let mut gpus = Vec::new();
    let mut total_vram: u64 = 0;
    let mut total_used: u64 = 0;
    for i in 0..n {
        let Ok(dev) = nvml.device_by_index(i) else {
            continue;
        };
        let name = dev.name().unwrap_or_else(|_| format!("GPU {}", i));
        let (total, used) = dev
            .memory_info()
            .map(|m| (m.total as u64, m.used as u64))
            .unwrap_or((0, 0));
        total_vram = total_vram.saturating_add(total);
        total_used = total_used.saturating_add(used);
        gpus.push(GpuInfo {
            name,
            vram_total_bytes: Some(total),
            memory_used_bytes: Some(used),
            backend: "CUDA".into(),
            device_index: i,
        });
    }
    if gpus.is_empty() {
        None
    } else {
        Some((gpus, total_vram, total_used))
    }
}

#[cfg(windows)]
fn gpus_from_wmi() -> Vec<GpuInfo> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress -Depth 4",
        ])
        .output();
    let Ok(out) = output else {
        return Vec::new();
    };
    if !out.status.success() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let v: Value = match serde_json::from_str(text.trim()) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let rows: Vec<Value> = match v {
        Value::Array(a) => a,
        Value::Object(_) => vec![v],
        _ => return Vec::new(),
    };
    rows.into_iter()
        .enumerate()
        .filter_map(|(idx, row)| {
            let name = row.get("Name")?.as_str()?.trim();
            if name.is_empty() {
                return None;
            }
            let vram = row.get("AdapterRAM").and_then(|x| x.as_i64()).filter(|&n| n > 0);
            Some(GpuInfo {
                name: name.to_string(),
                vram_total_bytes: vram.map(|n| n as u64),
                memory_used_bytes: None,
                backend: "WMI".into(),
                device_index: idx as u32,
            })
        })
        .collect()
}

#[cfg(not(windows))]
fn gpus_from_wmi() -> Vec<GpuInfo> {
    Vec::new()
}

#[cfg(target_os = "linux")]
fn gpus_from_nvidia_smi() -> Vec<GpuInfo> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total,memory.used",
            "--format=csv,noheader,nounits",
        ])
        .output();
    let Ok(out) = output else {
        return Vec::new();
    };
    if !out.status.success() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut gpus = Vec::new();
    for (idx, line) in text.lines().enumerate() {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.len() < 3 {
            continue;
        }
        let name = parts[0].to_string();
        let total_mb: u64 = parts[1].parse().unwrap_or(0);
        let used_mb: u64 = parts[2].parse().unwrap_or(0);
        let total = total_mb.saturating_mul(1024 * 1024);
        let used = used_mb.saturating_mul(1024 * 1024);
        gpus.push(GpuInfo {
            name,
            vram_total_bytes: Some(total),
            memory_used_bytes: Some(used),
            backend: "CUDA".into(),
            device_index: idx as u32,
        });
    }
    gpus
}

fn collect_gpus() -> (Vec<GpuInfo>, Option<u64>, u64) {
    if let Some((gpus, total_vram, total_used)) = try_nvml_gpus() {
        return (gpus, Some(total_vram), total_used);
    }
    #[cfg(target_os = "linux")]
    {
        let n = gpus_from_nvidia_smi();
        if !n.is_empty() {
            let total_vram: u64 = n.iter().filter_map(|g| g.vram_total_bytes).sum();
            let total_used: u64 = n.iter().filter_map(|g| g.memory_used_bytes).sum();
            return (n, Some(total_vram), total_used);
        }
    }
    let wmi = gpus_from_wmi();
    let total: u64 = wmi.iter().filter_map(|g| g.vram_total_bytes).sum();
    let used = 0u64;
    let vram_opt = if total > 0 { Some(total) } else { None };
    (wmi, vram_opt, used)
}

/// System + GPU inventory for the Hardware settings view.
#[tauri::command]
pub fn get_hardware_snapshot() -> Result<HardwareSnapshot, String> {
    if !sysinfo::IS_SUPPORTED_SYSTEM {
        return Ok(HardwareSnapshot {
            cpu_name: "Unknown".into(),
            cpu_arch: std::env::consts::ARCH.to_string(),
            cpu_features: vec![std::env::consts::ARCH.to_string()],
            cpu_compatible: true,
            ram_total_bytes: 0,
            ram_used_bytes: 0,
            vram_total_bytes: None,
            cpu_usage_percent: 0.0,
            combined_mem_used_gb: 0.0,
            gpus: Vec::new(),
            gpu_summary: "System information is not available on this platform.".into(),
        });
    }

    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );
    std::thread::sleep(Duration::from_millis(
        sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.as_millis() as u64 + 50,
    ));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown CPU".into());

    let cpu_arch = System::cpu_arch().unwrap_or_else(|| std::env::consts::ARCH.to_string());
    let mut cpu_features = vec![cpu_arch.clone()];
    cpu_features.extend(cpu_feature_tags());

    let ram_total = sys.total_memory();
    let ram_used = sys.used_memory();
    let cpu_usage = sys.global_cpu_usage() as f64;

    let (gpus, vram_total, gpu_mem_used) = collect_gpus();

    let gpu_summary = if gpus.is_empty() {
        "No dedicated GPU detected (or drivers not reporting to NVML / WMI).".into()
    } else if gpus.iter().any(|g| g.backend == "CUDA") {
        format!(
            "{} GPU{} detected with CUDA",
            gpus.len(),
            if gpus.len() == 1 { "" } else { "s" }
        )
    } else {
        format!(
            "{} display adapter{} detected",
            gpus.len(),
            if gpus.len() == 1 { "" } else { "s" }
        )
    };

    let combined_mem_used_gb =
        (ram_used as f64 + gpu_mem_used as f64) / (1024.0 * 1024.0 * 1024.0);

    Ok(HardwareSnapshot {
        cpu_name,
        cpu_arch,
        cpu_features,
        cpu_compatible: cpu_compatible(),
        ram_total_bytes: ram_total,
        ram_used_bytes: ram_used,
        vram_total_bytes: vram_total,
        cpu_usage_percent: cpu_usage,
        combined_mem_used_gb,
        gpus,
        gpu_summary,
    })
}
