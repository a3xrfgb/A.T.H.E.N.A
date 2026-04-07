use crate::db;
use crate::inference::engine::{ChatMsg, InferenceEngine};
use crate::models::mmproj;
use crate::types::AppSettings;
use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Json;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct SharedState {
    pub db_path: PathBuf,
    pub inference: Arc<InferenceEngine>,
    pub api_key: Arc<Mutex<Option<String>>>,
}

pub fn router(state: SharedState) -> axum::Router {
    axum::Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(list_models))
        .route("/v1/chat/completions", post(chat_completions))
        .with_state(state)
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "app": "Athena" }))
}

fn check_key(headers: &HeaderMap, expected: &Option<String>) -> bool {
    if let Some(key) = expected {
        if key.is_empty() {
            return true;
        }
        let auth = headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let ok = auth == format!("Bearer {}", key) || auth == *key;
        return ok;
    }
    true
}

async fn load_settings(path: PathBuf) -> Result<AppSettings, StatusCode> {
    tokio::task::spawn_blocking(move || {
        let conn = rusqlite::Connection::open(path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        db::load_settings(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
}

async fn list_models(
    State(st): State<SharedState>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let settings = load_settings(st.db_path.clone()).await?;
    let key = {
        let g = st.api_key.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        g.clone()
    };
    if !check_key(&headers, &key) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let model_path = resolve_model_path(&settings).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let mmproj_path = mmproj::resolve_mmproj_path(
        std::path::Path::new(&settings.data_dir),
        &settings.default_model,
    )
    .ok()
    .flatten();
    let base = st
        .inference
        .ensure_llama_server(
            std::path::Path::new(&model_path),
            mmproj_path.as_deref(),
            &settings,
        )
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    let v = st
        .inference
        .list_models_openai(&base)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(Json(v).into_response())
}

async fn chat_completions(
    State(st): State<SharedState>,
    headers: HeaderMap,
    body: Json<Value>,
) -> Result<Response, StatusCode> {
    let settings = load_settings(st.db_path.clone()).await?;
    let key = {
        let g = st.api_key.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        g.clone()
    };
    if !check_key(&headers, &key) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let model_path = resolve_model_path(&settings).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let mmproj_path = mmproj::resolve_mmproj_path(
        std::path::Path::new(&settings.data_dir),
        &settings.default_model,
    )
    .ok()
    .flatten();
    let base = st
        .inference
        .ensure_llama_server(
            std::path::Path::new(&model_path),
            mmproj_path.as_deref(),
            &settings,
        )
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if stream {
        return sse_proxy(&base, &body.0).await;
    }

    let messages = parse_messages(body.0.get("messages"))?;
    let model_echo = body
        .0
        .get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("local");
    let reply = st
        .inference
        .chat_complete(
            &base,
            messages,
            settings.temperature,
            settings.max_tokens,
            serde_json::json!({ "enable_thinking": false }),
        )
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let model_resolved = st
        .inference
        .openai_model_id()
        .await
        .unwrap_or_else(|| model_echo.to_string());

    let out = json!({
        "id": format!("chatcmpl-{}", uuid::Uuid::new_v4()),
        "object": "chat.completion",
        "created": chrono::Utc::now().timestamp(),
        "model": model_resolved,
        "choices": [{
            "index": 0,
            "message": { "role": "assistant", "content": reply },
            "finish_reason": "stop"
        }]
    });
    Ok(Json(out).into_response())
}

fn parse_messages(v: Option<&Value>) -> Result<Vec<ChatMsg>, StatusCode> {
    let arr = v.and_then(|x| x.as_array()).ok_or(StatusCode::BAD_REQUEST)?;
    let mut out = Vec::new();
    for m in arr {
        let role = m["role"].as_str().unwrap_or("user").to_string();
        let content = m["content"].as_str().unwrap_or("").to_string();
        out.push(ChatMsg { role, content });
    }
    Ok(out)
}

async fn sse_proxy(base: &str, body: &Value) -> Result<Response, StatusCode> {
    use futures_util::StreamExt;
    use reqwest::Client;
    let client = Client::new();
    let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
    let res = client
        .post(&url)
        .json(body)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    if !res.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }
    let stream = res.bytes_stream().map(|r| {
        r.map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "stream"))
    });
    let body = Body::from_stream(stream);
    let mut resp = Response::new(body);
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    Ok(resp)
}

fn resolve_model_path(settings: &AppSettings) -> Option<String> {
    if settings.default_model.is_empty() {
        return None;
    }
    let models_dir = crate::models::manager::ensure_models_dir(std::path::Path::new(
        &settings.data_dir,
    ))
    .ok()?;
    crate::models::manager::resolve_gguf_path(&models_dir, &settings.default_model)
        .map(|p| p.to_string_lossy().to_string())
}
