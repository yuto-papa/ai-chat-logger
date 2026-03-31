# ThinkTool

A desktop app to manage AI research sessions with **Claude / Codex / Gemini**  
using a mind map interface, built with Electron.

---

## Overview

- Organize research topics as nodes in a hierarchy; start an AI conversation from any node
- Automatically syncs node structure with project folder structure
- Conversation history is saved by the CLI tool (`~/.claude/projects/`, etc.)
- Works within subscription plans — no API billing required

---

## Layout

```
┌──────────────┬────────────────────────────┬──────────────────┐
│  Left Pane   │      Middle Pane           │  Right Pane      │
│  ProjectTree │   MindMap (upper half)     │  FileExplorer    │
│              │   NodeTerminal (lower half)│                  │
│  ─────────── │                            │                  │
│  Temp        │                            │                  │
│  Terminal    │                            │                  │
└──────────────┴────────────────────────────┴──────────────────┘
```

### Left Pane
- Project tree (node hierarchy)
- Recent projects list (up to 16 entries)
- Temporary terminal at the bottom (general-purpose shell, unsaved)

### Middle Pane
- **Mind Map**: Visualizes nodes as a graph. Right-click to launch AI CLI or add child nodes
- **Terminal**: Built-in xterm.js terminal with WebGL renderer
- Drag the divider between map and terminal to resize

### Right Pane
- File explorer (home directory when no project is open)
- Shows project root when a project is open
- Toggle visibility with the accordion button on the right edge

---

## Requirements

| Item | Requirement |
|---|---|
| OS | Windows 10/11, macOS, Linux |
| Node.js | v18 or later |
| npm | v9 or later |
| AI CLI | `claude`, `codex`, and/or `gemini` available in PATH |

---

## Installation

```bash
git clone <repository-url>
cd claudelogger
npm install
```

> `node-pty` native bindings are built automatically during `npm install`.

---

## Running the App

### Development mode

```bash
npm run dev
```

### Run after building

```bash
npm run build
npx electron dist-electron/main.js
```

### Package as installer (Windows)

```bash
npx electron-builder
```

Output: `release/`

---

## Usage

### Open a project

1. Click **"Open Project"** in the left pane
2. Select a folder — it becomes the project root
3. `tree.json` is created automatically if it doesn't exist

### Create a new project

1. Click **"New Project"** in the left pane
2. Select a folder — `tree.json` and an initial root node are created

### Start an AI conversation

1. **Right-click** a node in the mind map or left pane tree
2. Select **"Open with Claude"**, **"Open with Codex"**, or **"Open with Gemini"**
3. The AI CLI launches in the terminal at the bottom of the middle pane

### Add a child node

- Right-click a node in the mind map → **"Add child node"**
- A subfolder is automatically created with the same name

---

## Project Folder Structure

```
<projectRoot>/
├── tree.json           ← Node tree data (auto-managed)
├── layout.json         ← Mind map layout positions (auto-managed)
├── <node-name>/
│   ├── <child-node-name>/
│   └── ...
└── ...
```

User settings:

```
~/.thinktool/
└── recent.json         ← Recently opened projects (up to 16 entries)
```

---

## Testing

```bash
# Unit tests + IPC tests
npm test

# With coverage report
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e

# Playwright UI mode (for debugging)
npm run test:e2e:ui
```

---

## Tech Stack

| Item | Technology |
|---|---|
| Framework | Electron 28 + React 18 + TypeScript |
| Build tool | Vite 5 |
| Terminal | xterm.js 5 (WebGL add-on) |
| Mind map | React Flow 11 |
| PTY | node-pty |
| Testing | Vitest + Playwright |

---

## Known Limitations

| Item | Status |
|---|---|
| Folder rename when a node is renamed | Not implemented (tree.json only) |
| Session resume for Codex / Gemini | Not implemented (always starts new session) |
| Export to Markdown / PDF | Not implemented (planned for future) |
| Multi-LLM comparison view | Not implemented (planned for future) |

---

## License

MIT
