<div align="center">

# A.T.H.E.N.A

**Adaptive Thinking & Heuristic Engine for Natural Assistance**

A privacy-first, local-first AI desktop assistant built with Tauri 2, Rust, and React. 100% FREE!!!


</div>

---

## Overview

A.T.H.E.N.A is a cross-platform desktop AI chat application that runs entirely on your local machine. compatible local inference with Llama.cpp server and keeps your conversations, documents, and data fully under your control. no cloud required, no telemetry, no subscriptions.

The frontend is built with React 19 + TypeScript + Tailwind CSS, the backend shell is Rust via Tauri 2, and state is managed with Zustand. 

---

## Features

- **Local LLM support** — Gemma-2B, 4B & Qwen-3.5 9B only (connects to llama.cpp server)
- **Privacy-first** — all data stays on-device; no external API calls.
- **Rich document handling** — read and chat with PDFs (`pdfjs-dist`), EPUBs (`epubjs`), and CSVs (`papaparse`)
- **Markdown rendering** — `react-markdown` + `remark-gfm`, `highlight.js`
- **Mermaid diagrams** — renders diagrams inline in chat responses
- **PDF export** — export conversations to PDF with `jspdf`
- **Radix UI primitives** — accessible dialogs, dropdowns, context menus, tabs...
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

### 3. Downlaod the Model weights, llama.cpp files

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
