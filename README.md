<div align="center">

# A.T.H.E.N.A

**Adaptive Thinking & Heuristic Engine for Natural Assistance**

A privacy-first, local-first AI desktop assistant built with Tauri 2, Rust, and React.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-purple)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org)

</div>

---

## Overview

A.T.H.E.N.A is a cross-platform desktop AI chat application that runs entirely on your local machine. It connects to any OpenAI-compatible local inference server (LM Studio, Ollama, etc.) and keeps your conversations, documents, and data fully under your control — no cloud required, no telemetry, no subscriptions.

The frontend is built with React 19 + TypeScript + Tailwind CSS, the backend shell is Rust via Tauri 2, and state is managed with Zustand. The UI features a dark-first violet aesthetic with smooth Framer Motion animations.

---

## Features

- **Local LLM support** — connects to any OpenAI-compatible endpoint (LM Studio, Ollama, etc.)
- **Privacy-first** — all data stays on-device; no external API calls unless you configure one
- **Rich document handling** — read and chat with PDFs (`pdfjs-dist`), EPUBs (`epubjs`), and CSVs (`papaparse`)
- **Markdown rendering** — full GFM support via `react-markdown` + `remark-gfm`, with syntax highlighting via `highlight.js`
- **Mermaid diagrams** — renders diagrams inline in chat responses
- **PDF export** — export conversations to PDF with `jspdf`
- **Radix UI primitives** — accessible dialogs, dropdowns, context menus, tabs, sliders, toasts
- **Persistent storage** — SQLite database at `~/.athena/athena.db` via Tauri's Rust backend
- **File system access** — native file dialogs and FS access via Tauri plugins
- **Cross-platform** — Windows, macOS, and Linux via Tauri 2

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) |
| Frontend framework | React 19 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 5 |
| Animations | Framer Motion 12 |
| UI primitives | Radix UI |
| Build tool | Vite 7 |
| Package manager | pnpm |

---

## Prerequisites

- [Node.js](https://nodejs.org) v20 LTS or later
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- [Rust](https://rustup.rs) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS:
  - **Windows**: Microsoft C++ Build Tools + WebView2
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk`, `libssl-dev`, and related packages
- A running local LLM server (e.g. [LM Studio](https://lmstudio.ai) on port `1234` or [Ollama](https://ollama.com) on port `11434`)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/a3xrfgb/A.T.H.E.N.A.git
cd A.T.H.E.N.A
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start your local LLM server

**LM Studio** — load a model and start the local server (default: `http://localhost:1234/v1`)

**Ollama** — run a model:
```bash
ollama run qwen2.5-coder:14b
```
Ollama's OpenAI-compatible endpoint is available at `http://localhost:11434/v1`.

### 4. Run in development mode

```bash
pnpm tauri dev
```

This starts the Vite dev server and the Tauri window simultaneously with hot-reload.

### 5. Build for production

```bash
pnpm tauri build
```

The compiled installer/binary will be output to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
A.T.H.E.N.A/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   ├── stores/             # Zustand state stores
│   ├── hooks/              # Custom React hooks
│   └── main.tsx            # Frontend entry point
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   └── main.rs         # Tauri commands & app setup
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── public/                 # Static assets
├── scripts/                # Build / utility scripts
├── index.html              # Vite entry HTML
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind configuration
└── package.json
```

---

## Configuration

On first launch, open **Settings** inside the app and configure:

| Setting | Description | Default |
|---|---|---|
| API Base URL | Your local inference server endpoint | `http://localhost:1234/v1` |
| Model | Model ID to use for completions | depends on server |
| System Prompt | Global system instructions | (optional) |
| Temperature | Sampling temperature | `0.7` |
| Max Tokens | Max tokens per response | `2048` |

Settings are persisted locally in the SQLite database at `~/.athena/athena.db`.

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with the following extensions:
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change, then submit a pull request against `main`.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a PR

---

## License

Distributed under the [Apache 2.0 License](LICENSE).

---

<div align="center">
Built with ❤️ using Tauri · Rust · React · TypeScript
</div>
