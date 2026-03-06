# CLAUDE.md — PDF View & Edit Project Rules

## Project Overview
Desktop PDF viewer/editor built with Electron + React + TypeScript. Uses MuPDF.js for rendering/redaction and pdf-lib for content insertion. Fabric.js provides the annotation/drawing layer.

## Technology Stack
- **Runtime:** Electron (latest stable)
- **Frontend:** React 18+ with TypeScript (strict mode)
- **PDF Rendering:** MuPDF.js (WASM) — high-fidelity page rendering, text extraction, redaction
- **PDF Editing:** pdf-lib — new text, images, overlays, page manipulation
- **Canvas/Drawing:** Fabric.js 6+ — annotations, shapes, lines, signatures, free drawing
- **Build Tool:** Vite (for renderer process)
- **Package Manager:** npm
- **Testing:** Vitest (unit), Playwright (e2e)
- **Linting:** ESLint + Prettier

## Architecture Rules

### Dual-Canvas Architecture
Every PDF page uses two stacked canvases:
1. **Bottom canvas:** MuPDF renders the PDF page (read-only raster)
2. **Top canvas:** Fabric.js handles all interactive objects (annotations, shapes, text edits, signatures)

When saving, Fabric.js objects are serialized back into the PDF via pdf-lib (new content) or MuPDF (redactions/annotations).

### Process Separation (Electron)
- **Main process:** File I/O, native dialogs, window management, PDF loading/saving via MuPDF.js
- **Renderer process:** React UI, Fabric.js canvas, user interaction
- **Preload script:** Exposes a typed `window.electronAPI` bridge via contextBridge. No `nodeIntegration`.

### Directory Structure
```
src/
  main/           # Electron main process
    index.ts      # Entry point, window creation
    ipc/          # IPC handlers (file ops, PDF ops)
    pdf/          # MuPDF.js + pdf-lib integration
  renderer/       # React app (Vite-bundled)
    components/   # React components
    hooks/        # Custom React hooks
    stores/       # State management (Zustand)
    utils/        # Helper functions
    styles/       # CSS/SCSS
  preload/        # Preload scripts
  shared/         # Types shared between main/renderer
```

## Coding Standards

### TypeScript
- Strict mode always enabled (`"strict": true`)
- No `any` types — use `unknown` and type guards instead
- All function parameters and return types must be explicitly typed
- Use interfaces for object shapes, types for unions/intersections
- Prefer `const` assertions and enums for fixed sets of values

### React
- Functional components only — no class components
- Custom hooks for reusable logic (prefix with `use`)
- Memoize expensive computations with `useMemo`, callbacks with `useCallback`
- Use Zustand for global state — no prop drilling beyond 2 levels
- Avoid inline styles — use CSS modules or styled-components

### File Naming
- Components: `PascalCase.tsx` (e.g., `PageRenderer.tsx`)
- Hooks: `camelCase.ts` (e.g., `usePdfDocument.ts`)
- Utilities: `camelCase.ts` (e.g., `coordinateTransform.ts`)
- Types: `PascalCase.types.ts` (e.g., `Annotation.types.ts`)
- Tests: `*.test.ts` / `*.test.tsx` co-located with source

### Error Handling
- Never swallow errors silently — always log or surface to user
- Use Result/Either pattern for operations that can fail (PDF loading, saving)
- Wrap MuPDF.js and pdf-lib calls in try/catch with meaningful error messages
- Show user-facing errors in a toast/notification system, not alerts

### Security
- **Redaction must be permanent.** Use MuPDF's redaction API to remove content from the PDF content stream. Never use visual-only overlays for redaction.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Validate all file paths from user input
- Sanitize PDF content before rendering to prevent PDF-based exploits
- No `eval()`, no `new Function()`, no `innerHTML` with user content

## PDF-Specific Rules

### Rendering
- Always render at device pixel ratio for crisp display on HiDPI screens
- Cache rendered pages in memory (limit: 10 pages ahead/behind viewport)
- Use intersection observer for lazy page rendering in scroll view

### Text Editing
- Use overlay approach: extract text metrics from MuPDF, create Fabric.js text object positioned precisely over original text
- When saving edits, use redact-and-replace: MuPDF removes original text, pdf-lib inserts new text at same position with matched font metrics
- Preserve original font family, size, color, and spacing as closely as possible

### Annotations & Drawing
- All Fabric.js objects must store their PDF-coordinate position (not screen pixels)
- Convert between screen coords and PDF coords using the page's transformation matrix
- Shapes: rectangle, ellipse, line, arrow, polygon, freehand
- Each object must have: stroke color, fill color, stroke width, opacity

### Signatures
- Three modes: draw (freehand), type (text with script font), upload (image file)
- Signatures are stored as Fabric.js objects until save
- On save, signatures are flattened into the PDF as images (PNG with transparency)
- Allow saving signature for reuse across documents

### Saving
- Always create a new file by default (do not overwrite original unless user explicitly chooses "Save" over "Save As")
- Flatten all annotations into the PDF content when saving
- After save, verify the output file is a valid PDF
- Strip incremental updates when redactions are present (prevents recovering redacted content)

## Git & Workflow
- Commit messages: conventional commits format (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)
- One feature per branch, PR-based workflow
- All code must pass linting and type-checking before commit
- Tests must pass before merge

## Performance Targets
- PDF load time: < 2 seconds for a 100-page document
- Page render time: < 200ms per page at 150 DPI
- Annotation interaction: 60fps canvas updates
- Memory: < 500MB for a 200-page document with annotations
- App startup: < 3 seconds cold start

## Do NOT
- Do not add features beyond what is specified in the plan
- Do not add excessive comments — code should be self-documenting
- Do not create abstraction layers for things used in only one place
- Do not use `console.log` for production code — use a structured logger
- Do not store temporary/session state in persistent storage
- Do not use synchronous file I/O in the main process (blocks the event loop)
