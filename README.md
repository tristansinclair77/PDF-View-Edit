# PDF View & Edit

A desktop PDF viewer and editor built with Electron, React, and TypeScript.

## Features

- **PDF Viewing** — High-fidelity rendering powered by MuPDF.js (WASM)
- **Text Editing** — Click any text to edit in place; changes are saved back to the PDF
- **Annotations** — Rectangles, ellipses, lines, arrows, freehand drawing
- **Highlighting** — Semi-transparent yellow overlay for marking text
- **Redaction** — Permanently remove sensitive content from the PDF content stream
- **Signatures** — Draw, type, or upload a signature image and place it on any page
- **Image Insertion** — Add images to any page
- **Text Boxes** — Add new text anywhere on a page
- **Undo/Redo** — Full undo/redo support for all annotation operations
- **Zoom** — Zoom in/out with keyboard shortcuts or toolbar controls
- **Multi-page** — Scroll through all pages with lazy rendering for performance
- **Save/Export** — Save edited PDFs with all annotations flattened into the document

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 33 |
| Frontend | React 19, TypeScript (strict) |
| PDF Rendering | MuPDF.js (WASM) |
| PDF Editing | pdf-lib |
| Canvas/Drawing | Fabric.js 7 |
| State Management | Zustand 5 |
| Build Tool | electron-vite 5 |
| Testing | Vitest, Playwright |

## Architecture

**Dual-canvas per page:**
1. Bottom canvas — MuPDF renders the PDF page (read-only raster)
2. Top canvas — Fabric.js handles all interactive objects (annotations, shapes, text edits, signatures)

**Electron process separation:**
- Main process — File I/O, native dialogs, window management, PDF operations via MuPDF.js and pdf-lib
- Renderer process — React UI, Fabric.js canvas, user interaction
- Preload script — Typed `window.electronAPI` bridge via `contextBridge` (no `nodeIntegration`)

## Project Structure

```
src/
  main/              # Electron main process
    index.ts         # Entry point, window creation
    ipc/             # IPC handlers (file ops, PDF ops)
    pdf/             # MuPDF.js + pdf-lib integration
    menu.ts          # Application menu
  renderer/          # React app (Vite-bundled)
    components/      # React components
    hooks/           # Custom React hooks
    stores/          # Zustand state management
    utils/           # Helper functions
    styles/          # CSS
  preload/           # Preload scripts
  shared/            # Types shared between main/renderer
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts Electron with hot-reload via electron-vite.

### Build

```bash
npm run build
```

To package a distributable:

```bash
npm run build:electron
```

### Test

```bash
npm test
```

### Lint & Type Check

```bash
npm run lint
npm run typecheck
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+O | Open PDF |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+= | Zoom In |
| Ctrl+- | Zoom Out |
| Ctrl+0 | Reset Zoom |
| Delete/Backspace | Remove selected annotation |
| Arrow keys | Nudge selected object (Shift for 10px) |

## License

Copyright (c) 2026 Tristan Sinclair. All rights reserved.
