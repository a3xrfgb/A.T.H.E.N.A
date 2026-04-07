//! Minimal GGUF header reader for `*.context_length` and `*.block_count` (layer count).
use std::fs::File;
use std::io::{self, Cursor, Read};
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct GgufMeta {
    pub max_context_tokens: Option<u32>,
    pub layer_count: Option<u32>,
    pub embedding_length: Option<u32>,
}

/// GGUF types (ggml-org/llama.cpp gguf.h).
#[allow(dead_code)]
mod ty {
    pub const UINT8: u32 = 0;
    pub const INT8: u32 = 1;
    pub const UINT16: u32 = 2;
    pub const INT16: u32 = 3;
    pub const UINT32: u32 = 4;
    pub const INT32: u32 = 5;
    pub const FLOAT32: u32 = 6;
    pub const BOOL: u32 = 7;
    pub const STRING: u32 = 8;
    pub const ARRAY: u32 = 9;
    pub const UINT64: u32 = 10;
    pub const INT64: u32 = 11;
    pub const FLOAT64: u32 = 12;
}

fn read_u32(r: &mut Cursor<&[u8]>) -> io::Result<u32> {
    let mut b = [0u8; 4];
    r.read_exact(&mut b)?;
    Ok(u32::from_le_bytes(b))
}

fn read_u64(r: &mut Cursor<&[u8]>) -> io::Result<u64> {
    let mut b = [0u8; 8];
    r.read_exact(&mut b)?;
    Ok(u64::from_le_bytes(b))
}

fn read_string(r: &mut Cursor<&[u8]>) -> io::Result<String> {
    let len = read_u64(r)? as usize;
    let mut v = vec![0u8; len];
    r.read_exact(&mut v)?;
    String::from_utf8(v).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn skip_value(r: &mut Cursor<&[u8]>, typ: u32) -> io::Result<()> {
    match typ {
        ty::UINT8 | ty::INT8 | ty::BOOL => {
            r.set_position(r.position() + 1);
        }
        ty::UINT16 | ty::INT16 => {
            r.set_position(r.position() + 2);
        }
        ty::UINT32 | ty::INT32 | ty::FLOAT32 => {
            r.set_position(r.position() + 4);
        }
        ty::UINT64 | ty::INT64 | ty::FLOAT64 => {
            r.set_position(r.position() + 8);
        }
        ty::STRING => {
            let _ = read_string(r)?;
        }
        ty::ARRAY => {
            let elem_type = read_u32(r)?;
            let count = read_u64(r)?;
            for _ in 0..count {
                skip_value(r, elem_type)?;
            }
        }
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported gguf value type {typ}"),
            ));
        }
    }
    Ok(())
}

/// Read up to `max_bytes` from the start of a GGUF file and extract common metadata keys.
pub fn read_gguf_meta(path: &Path, max_bytes: usize) -> GgufMeta {
    let Ok(mut f) = File::open(path) else {
        return GgufMeta::default();
    };
    let mut buf = vec![0u8; max_bytes];
    let Ok(n) = f.read(&mut buf) else {
        return GgufMeta::default();
    };
    if n < 24 {
        return GgufMeta::default();
    }
    buf.truncate(n);
    let mut cur = Cursor::new(buf.as_slice());
    let mut magic = [0u8; 4];
    if cur.read_exact(&mut magic).is_err() {
        return GgufMeta::default();
    }
    if &magic != b"GGUF" {
        return GgufMeta::default();
    }
    let Ok(_version) = read_u32(&mut cur) else {
        return GgufMeta::default();
    };
    let Ok(n_tensors) = read_u64(&mut cur) else {
        return GgufMeta::default();
    };
    let Ok(n_kv) = read_u64(&mut cur) else {
        return GgufMeta::default();
    };
    let mut meta = GgufMeta::default();

    for _ in 0..n_kv {
        let Ok(key) = read_string(&mut cur) else {
            return meta;
        };
        let Ok(typ) = read_u32(&mut cur) else {
            return meta;
        };
        if typ == ty::UINT32 {
            let Ok(v) = read_u32(&mut cur) else {
                return meta;
            };
            let kl = key.to_ascii_lowercase();
            if kl.ends_with("context_length") {
                meta.max_context_tokens = Some(v);
            } else if kl.ends_with("block_count") {
                meta.layer_count = Some(v);
            } else if kl.ends_with("embedding_length") {
                meta.embedding_length = Some(v);
            }
        } else if skip_value(&mut cur, typ).is_err() {
            return meta;
        }
    }

    let _ = n_tensors;
    meta
}

/// True if the first `max_bytes` of the file contain `needle` (ASCII).
/// Used to detect Prism ML `Q1_0_g128` GGUFs that require their llama.cpp fork.
pub fn gguf_file_contains(path: &Path, needle: &[u8], max_bytes: usize) -> bool {
    if needle.is_empty() {
        return true;
    }
    let Ok(mut f) = File::open(path) else {
        return false;
    };
    let mut buf = vec![0u8; max_bytes];
    let Ok(n) = f.read(&mut buf) else {
        return false;
    };
    if n < needle.len() {
        return false;
    }
    buf.truncate(n);
    buf.windows(needle.len()).any(|w| w == needle)
}
