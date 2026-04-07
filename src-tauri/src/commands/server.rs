use crate::db::{self, Db};
use crate::server::api::{router, SharedState};
use crate::state::InferenceHandle;
use crate::types::ServerStatus;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct HttpServerCtl {
    inner: Mutex<Option<ServerInner>>,
}

struct ServerInner {
    shutdown_tx: tokio::sync::oneshot::Sender<()>,
    port: u16,
}

impl Default for HttpServerCtl {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn start_server(
    db: tauri::State<'_, Db>,
    inference: tauri::State<'_, InferenceHandle>,
    ctl: tauri::State<'_, HttpServerCtl>,
    port: u16,
    api_key: Option<String>,
) -> Result<(), String> {
    stop_server_inner(&ctl).await;
    let settings = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };

    let db_path: PathBuf = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn
            .path()
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(".athena")
                    .join("athena.db")
            })
    };

    let state = SharedState {
        db_path,
        inference: inference.0.clone(),
        api_key: Arc::new(Mutex::new(api_key.or_else(|| {
            let k = settings.api_key.clone();
            if k.is_empty() {
                None
            } else {
                Some(k)
            }
        }))),
    };

    let app = router(state);
    let addr = format!("127.0.0.1:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("bind {addr}: {e}"))?;
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });
    {
        let mut g = ctl.inner.lock().map_err(|e| e.to_string())?;
        *g = Some(ServerInner {
            shutdown_tx: tx,
            port,
        });
    }
    Ok(())
}

async fn stop_server_inner(ctl: &HttpServerCtl) {
    let mut g = ctl.inner.lock().ok();
    if let Some(inner) = g.as_mut().and_then(|x| x.take()) {
        let _ = inner.shutdown_tx.send(());
    }
}

#[tauri::command]
pub async fn stop_server(ctl: tauri::State<'_, HttpServerCtl>) -> Result<(), String> {
    stop_server_inner(&ctl).await;
    Ok(())
}

#[tauri::command]
pub fn get_server_status(ctl: tauri::State<'_, HttpServerCtl>) -> Result<ServerStatus, String> {
    let g = ctl.inner.lock().map_err(|e| e.to_string())?;
    if let Some(inner) = g.as_ref() {
        Ok(ServerStatus {
            running: true,
            port: inner.port,
            url: format!("http://127.0.0.1:{}/v1", inner.port),
        })
    } else {
        Ok(ServerStatus {
            running: false,
            port: 0,
            url: String::new(),
        })
    }
}
