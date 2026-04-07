use crate::inference::engine::InferenceEngine;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub struct StreamCancel(pub Arc<AtomicBool>);

impl Default for StreamCancel {
    fn default() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }
}

pub struct InferenceHandle(pub Arc<InferenceEngine>);
