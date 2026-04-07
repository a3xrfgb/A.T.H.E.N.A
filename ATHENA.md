## Overview

You are a senior Rust + TypeScript full-stack engineer. Your task is to scaffold and implement **Athena** — a privacy-first, local-AI desktop application built with **Tauri 2** (Rust backend) and **React + TypeScript + Vite** (frontend). 
Build Athena from scratch using the architecture and features described below.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Tauri 2 (`tauri = "2"`) |
| Backend language | Rust (stable toolchain) |
| Frontend framework | React 18 + TypeScript |
| Frontend build tool | Vite |
| Styling | Tailwind CSS v3 |
| UI Components | shadcn/ui (Radix primitives) |
| State management | Zustand |
| LLM inference | llama.cpp via `llama-cpp-rs` crate or sidecar binary |
| API compatibility | OpenAI-compatible REST server at `localhost:11434` |
| IPC | Tauri `invoke()` commands + Tauri events |
| Persistence | SQLite via `rusqlite` (conversations, settings) |
| Package manager | `pnpm` (frontend), `cargo` (backend) |

---

## Project Structure

Scaffold the following directory layout:

```
athena/
├── src-tauri/
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   │   └── (app icons — use placeholder 512x512 PNG)
│   └── src/
│       ├── main.rs           ← desktop entry (calls lib::run())
│       ├── lib.rs            ← Tauri builder + plugin registration
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── chat.rs       ← stream_chat, send_message
│       │   ├── models.rs     ← list_models, download_model, delete_model
│       │   ├── settings.rs   ← get_settings, save_settings
│       │   └── server.rs     ← start_server, stop_server, server_status
│       ├── models/
│       │   ├── mod.rs
│       │   ├── manager.rs    ← model download, cache, metadata
│       │   └── registry.rs   ← HuggingFace Hub model list fetcher
│       ├── inference/
│       │   ├── mod.rs
│       │   └── engine.rs     ← llama.cpp sidecar or crate integration
│       ├── server/
│       │   ├── mod.rs
│       │   └── api.rs        ← OpenAI-compatible local REST server
│       └── db/
│           ├── mod.rs
│           └── schema.rs     ← SQLite migrations (threads, messages, settings)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── MainPanel.tsx
│   │   ├── chat/
│   │   │   ├── ChatThread.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── StreamingDot.tsx
│   │   ├── models/
│   │   │   ├── ModelLibrary.tsx
│   │   │   ├── ModelCard.tsx
│   │   │   └── DownloadProgress.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ModelSettings.tsx
│   │   │   └── ServerSettings.tsx
│   │   └── ui/              ← shadcn/ui components (auto-generated)
│   ├── store/
│   │   ├── chatStore.ts
│   │   ├── modelStore.ts
│   │   └── settingsStore.ts
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useModels.ts
│   │   └── useServer.ts
│   ├── lib/
│   │   ├── tauri.ts         ← typed invoke wrappers
│   │   └── utils.ts
│   └── types/
│       ├── chat.ts
│       ├── model.ts
│       └── settings.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Rust Backend — Full Implementation

### `src-tauri/Cargo.toml`

```toml
[package]
name = "athena"
version = "0.1.0"
edition = "2021"

[lib]
name = "athena_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon", "protocol-asset"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-http = "2"
tauri-plugin-notification = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "1"
once_cell = "1"
dirs = "5"
futures-util = "0.3"
axum = { version = "0.7", features = ["json"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors"] }

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

---

### `src-tauri/src/lib.rs` — Tauri App Builder

Implement the full Tauri app builder:

```rust
use tauri::Manager;

mod commands;
mod db;
mod inference;
mod models;
mod server;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            db::init(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message,
            commands::chat::stream_chat,
            commands::chat::get_thread_messages,
            commands::chat::create_thread,
            commands::chat::delete_thread,
            commands::chat::list_threads,
            commands::models::list_local_models,
            commands::models::download_model,
            commands::models::delete_model,
            commands::models::get_model_info,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::get_server_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Athena");
}
```

---

### Commands to Implement (Rust)

#### `commands/chat.rs`

- `create_thread(title: String) -> Result<Thread>`
- `list_threads() -> Result<Vec<Thread>>`
- `delete_thread(thread_id: String) -> Result<()>`
- `get_thread_messages(thread_id: String) -> Result<Vec<Message>>`
- `send_message(thread_id: String, content: String, model_id: String) -> Result<Message>` — calls inference engine, returns full response
- `stream_chat(window: Window, thread_id: String, content: String, model_id: String) -> Result<()>` — emits `athena://token` events per token to the frontend

#### `commands/models.rs`

- `list_local_models() -> Result<Vec<ModelInfo>>` — scans `~/.athena/models/` for GGUF files
- `download_model(model_id: String, url: String) -> Result<()>` — streams download with progress events `athena://download-progress`
- `delete_model(model_id: String) -> Result<()>`
- `get_model_info(model_id: String) -> Result<ModelInfo>`

#### `commands/settings.rs`

- `get_settings() -> Result<AppSettings>`
- `save_settings(settings: AppSettings) -> Result<()>`

Settings struct:
```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub theme: String,           // "dark" | "light" | "system"
    pub default_model: String,
    pub server_port: u16,        // default 11434
    pub server_enabled: bool,
    pub max_tokens: u32,
    pub temperature: f32,
    pub context_length: u32,
    pub gpu_layers: i32,         // -1 = auto
    pub data_dir: String,
}
```

#### `commands/server.rs`

- `start_server(port: u16) -> Result<()>` — spawns OpenAI-compatible Axum server
- `stop_server() -> Result<()>`
- `get_server_status() -> Result<ServerStatus>`

---

### `db/schema.rs` — SQLite Schema

Run these migrations on app start:

```sql
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_id TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
```

---

### `server/api.rs` — OpenAI-Compatible Local API

Implement an Axum HTTP server with these routes:

- `GET  /v1/models` — list loaded models in OpenAI format
- `POST /v1/chat/completions` — accept OpenAI chat format, return streaming SSE or full JSON response
- `GET  /health` — returns `{"status": "ok", "app": "Athena"}`

This allows other tools (OpenWebUI, Continue.dev, RooCode, LM Studio clients) to connect to Athena as if it were an OpenAI endpoint.

---

### `tauri.conf.json`

```json
{
  "productName": "Athena",
  "identifier": "ai.athena.app",
  "version": "0.1.0",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Athena",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

---

## Frontend — Full Implementation

### Design System

- **Color palette**: Dark-first. Background `#0d0d0f`, sidebar `#111114`, surface `#18181c`, accent `#7c6af7` (violet), text primary `#f0f0f5`, text muted `#6b6b80`
- **Typography**: `Inter` for UI, `JetBrains Mono` for code/model output
- **Border radius**: `8px` default, `12px` for cards
- **Animations**: Subtle fade-in for messages, shimmer for loading states

---

### `src/App.tsx` — Layout Shell

Three-column layout:
1. **Left sidebar** (240px) — thread list + navigation icons (Chat, Models, Settings)
2. **Main content** — chat thread or active panel
3. **Right panel** (optional, collapsible) — model info / context inspector

Use React Router or a simple view state — no routing library required.

---

### `src/components/chat/ChatThread.tsx`

- Display messages in a scrollable container, newest at bottom
- Auto-scroll to bottom on new tokens
- Support markdown rendering (`react-markdown` + `remark-gfm`)
- Code blocks with syntax highlighting (`highlight.js` or `shiki`)
- Copy-to-clipboard button on code blocks
- Show token count + model name in message footer (small, muted)
- Streaming tokens: listen to `athena://token` Tauri event, append to last message in real-time with a blinking cursor

---

### `src/components/chat/ChatInput.tsx`

- Textarea that auto-resizes (min 1 row, max 6)
- Submit on `Enter`, newline on `Shift+Enter`
- Model selector dropdown (shows locally available models)
- Send button with loading spinner during streaming
- Stop generation button (cancels stream)
- Disabled state during streaming

---

### `src/components/models/ModelLibrary.tsx`

- Grid of model cards with: name, size, parameter count, quantization type, source
- Filter by: size (3B, 7B, 13B, 70B+), type (chat, code, vision), source (local, HuggingFace)
- Download button with real-time progress bar (connected to `athena://download-progress` event)
- Delete button with confirmation dialog
- "Loaded" badge for the currently active model

---

### `src/components/settings/SettingsPanel.tsx`

Three tabs: **General**, **Model**, **Server**

**General**:
- Theme selector (Dark / Light / System)
- Data directory path picker (uses Tauri dialog)
- Clear all conversations button

**Model**:
- Default model selector
- Temperature slider (0.0 – 2.0)
- Max tokens input
- Context length selector (2048 / 4096 / 8192 / 16384 / 32768)
- GPU layers input (-1 = auto-detect)

**Server**:
- Enable/disable local API toggle
- Port number input (default 11434)
- API key field (optional, for securing the local endpoint)
- Status indicator (running / stopped) with start/stop button
- Display the API base URL: `http://localhost:{port}/v1`
- Copy URL button

---

### `src/store/chatStore.ts` (Zustand)

```typescript
interface ChatStore {
  threads: Thread[];
  activeThreadId: string | null;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  
  setActiveThread: (id: string) => void;
  createThread: (title?: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  sendMessage: (content: string, modelId: string) => Promise<void>;
  appendToken: (threadId: string, token: string) => void;
  stopStreaming: () => void;
}
```

---

### `src/store/modelStore.ts` (Zustand)

```typescript
interface ModelStore {
  localModels: ModelInfo[];
  activeModelId: string | null;
  downloadingModels: Record<string, DownloadProgress>;
  
  loadLocalModels: () => Promise<void>;
  downloadModel: (id: string, url: string) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setActiveModel: (id: string) => void;
}
```

---

## TypeScript Types

### `src/types/chat.ts`

```typescript
export interface Thread {
  id: string;
  title: string;
  modelId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  tokensUsed?: number;
  createdAt: number;
}
```

### `src/types/model.ts`

```typescript
export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  parameters: string;     // e.g. "7B"
  quantization: string;   // e.g. "Q4_K_M"
  format: string;         // "GGUF"
  localPath: string;
  isLoaded: boolean;
}

export interface DownloadProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'complete' | 'error';
}
```

---

## Features Checklist

Build ALL of the following features completely — no stubs:

### Core Chat
- [x] Create, rename, and delete chat threads
- [x] Send messages and receive streamed responses
- [x] Stop generation mid-stream
- [x] Markdown + code block rendering in messages
- [x] Copy message content to clipboard
- [x] Regenerate last assistant response
- [x] Clear thread history

### Model Management
- [x] Scan `~/.athena/models/` for GGUF files on startup
- [x] Display model list in sidebar and settings
- [x] Download models from URL with real-time progress
- [x] Delete local models with confirmation
- [x] Switch active model per thread

### Local API Server
- [x] Toggle OpenAI-compatible server on/off from settings
- [x] Configurable port (default 11434)
- [x] `/v1/chat/completions` endpoint (streaming + non-streaming)
- [x] `/v1/models` endpoint
- [x] Display server URL in settings for copy/paste

### Settings & Persistence
- [x] All settings persisted to SQLite
- [x] Per-thread model selection persisted
- [x] Full conversation history persisted and restored on launch
- [x] Theme applied immediately on change

### UX Polish
- [x] Keyboard shortcut: `Cmd/Ctrl+N` → new thread
- [x] Keyboard shortcut: `Cmd/Ctrl+,` → open settings
- [x] Sidebar collapse toggle
- [x] Empty state screens for no threads / no models
- [x] Toast notifications for download complete, errors, server start/stop
- [x] Window title updates to active thread name

---

## Build & Dev Commands

After scaffolding, ensure these work:

```bash
# Install frontend deps
pnpm install

# Dev mode (hot reload frontend + Rust rebuild on change)
pnpm tauri dev

# Production build
pnpm tauri build
```

---

## Important Constraints

1. **No external AI API calls by default** — Athena is offline-first. Cloud providers (OpenAI, Anthropic, etc.) can be added as optional remote backends later but are not part of this initial build.
2. **All user data stays local** — no telemetry, no analytics, no network calls except model downloads (which are opt-in).
3. **Windows 10/11 must be the primary target** for testing and build validation. Also support macOS and Linux.
4. **Do not use Electron** — Tauri only.
5. **Do not copy any source code** — build from scratch using the feature spec above.
6. **App identifier** is `ai.athena.app`, bundle name is `Athena`, binary name is `athena`.
7. **Models directory**: `~/.athena/models/` — create it on first launch if it doesn't exist.
8. **SQLite database**: `~/.athena/athena.db`

---

## First Steps for Agent

Execute in this order:

1. Run `cargo install create-tauri-app --locked` if not already installed
2. Scaffold: `pnpm create tauri-app@latest athena --template react-ts`
3. `cd athena`
4. Replace generated source with the full implementation described above
5. Install frontend deps: `pnpm add zustand react-markdown remark-gfm highlight.js lucide-react clsx tailwind-merge @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slider @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast`
6. Update `Cargo.toml` with all required crates
7. Implement all Rust modules in `src-tauri/src/`
8. Implement all React components in `src/`
9. Verify `pnpm tauri dev` launches without errors
10. Run `pnpm tauri build` and confirm a binary is produced in `src-tauri/target/release/`

