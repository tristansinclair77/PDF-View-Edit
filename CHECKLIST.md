# PDF View & Edit — Implementation Checklist

## Phase 1: Project Scaffolding & PDF Viewing

- [x] Initialize npm project with `package.json`
- [x] Install Electron, React, TypeScript, Vite dependencies
- [x] Configure TypeScript (`tsconfig.json` for main, renderer, preload)
- [x] Configure Vite for renderer process (electron-vite)
- [x] Configure electron-builder (`electron-builder.yml`)
- [x] Create Electron main process entry (`src/main/index.ts`)
- [x] Create preload script with typed `contextBridge` API (`src/preload/index.ts`)
- [x] Create React renderer entry (`src/renderer/main.tsx`, `App.tsx`)
- [x] Verify dev mode works: `npm run dev` launches Electron with React hot reload
- [x] Install and configure MuPDF.js (`npm install mupdf`)
- [x] Load MuPDF WASM module in main process successfully
- [x] Implement IPC handler: `file:open` — native file dialog → read PDF as ArrayBuffer
- [x] Implement IPC handler: `pdf:load` — parse PDF with MuPDF.js → return doc info
- [x] Implement IPC handler: `pdf:render-page` — render page at given DPI → return image data
- [x] Build `PageRenderer` component — displays a single MuPDF-rendered page
- [x] Build `PageList` component — scrollable vertical list of all pages
- [x] Implement lazy rendering with `IntersectionObserver` (only render visible pages)
- [x] Implement LRU page cache (max 10 pages in memory)
- [x] Build `Toolbar` component with Open button
- [x] Build `Sidebar` component with page thumbnails
- [x] Implement zoom controls: fit-width, fit-page, percentage dropdown, Ctrl+/- shortcuts
- [ ] Implement page navigation: Ctrl+G go-to-page dialog
- [x] Build `StatusBar` component showing page number, zoom level, modified state
- [ ] Test: Open a multi-page PDF and scroll through it smoothly
- [ ] Test: Zoom in/out at various levels and verify rendering quality

## Phase 2: Fabric.js Annotation Layer

- [x] Install Fabric.js (`npm install fabric`)
- [x] Create `AnnotationCanvas` component — transparent Fabric.js canvas per page
- [x] Stack Fabric.js canvas precisely over MuPDF canvas (pixel-aligned)
- [x] Build `CoordinateTransform` utility (screen pixels ↔ PDF points, handles zoom + DPI + Y-flip)
- [x] Synchronize Fabric.js canvas size with zoom changes
- [x] Implement object selection tool (click to select, drag to move, handles for resize/rotate)
- [x] Build `AnnotationStore` (Zustand) — per-page annotation state
- [x] Implement undo/redo stack for annotation actions
- [x] Implement keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, Delete remove
- [ ] Implement multi-select: Shift+click and drag selection box
- [x] Implement arrow key nudge (1px, Shift+arrow 10px)
- [ ] Test: Create objects on canvas, select/move/resize them, undo/redo

## Phase 3: Drawing Tools

- [x] Build `ToolStore` (Zustand) — active tool, stroke/fill colors, width, opacity
- [x] Implement Line tool — click-drag creates `fabric.Line`
- [x] Implement Arrow tool — line + arrowhead
- [x] Implement Rectangle tool — click-drag creates `fabric.Rect`
- [x] Implement Ellipse tool — click-drag creates `fabric.Ellipse`
- [x] Implement Freehand tool — Fabric.js `freeDrawingBrush` mode
- [x] Implement TextBox tool — click to place `fabric.IText`, type to fill
- [x] Implement Highlight tool — semi-transparent rectangle (default yellow, 40% opacity)
- [x] Build color picker (stroke/fill color inputs)
- [x] Build `PropertiesPanel` component — stroke color, fill color, width, opacity
- [ ] Wire property changes to selected objects (live update)
- [x] Add toolbar buttons for each drawing tool
- [x] Implement keyboard shortcuts for tool switching (V=select, T=editText, L=line, R=rect, E=ellipse, P=freehand, H=highlight)
- [ ] Test: Draw each shape type, change colors/properties, verify visual correctness

## Phase 4: Text Editing

- [x] Implement IPC handler: `pdf:extract-text` — MuPDF extracts text blocks with font metrics
- [x] Build text region detection — click on page identifies which text block was hit
- [x] Create Fabric.js `IText` overlay positioned exactly on the original text block
- [x] Style the IText to match: font family (mapped), font size, color
- [ ] Bundle additional common fonts (Liberation, DejaVu, Noto Sans/Serif)
- [x] Build `FontMapper` utility — maps PDF font names to system fonts
- [ ] Add visual indicator for editable text regions (blue border on hover in edit mode)
- [x] Handle text edit completion — store edit record (original bbox, new text, font info)
- [x] Implement redact-and-replace save path for text edits
- [ ] Build font matching quality indicator (exact match vs. approximate)
- [ ] Test: Edit text in various PDFs, verify visual consistency before/after save

## Phase 5: Image Operations

- [ ] Implement IPC handler: `pdf:extract-images` — extract images with positions (stub only)
- [x] Implement "Insert Image" tool — file dialog → load → place as `fabric.Image`
- [x] Support input formats: PNG, JPEG
- [x] Implement image move (drag), resize (handles), rotate (rotation handle)
- [ ] Implement aspect ratio lock on resize (Shift key)
- [ ] Implement image replacement (right-click → Replace Image)
- [x] Implement image deletion (Delete key)
- [ ] Implement layer ordering (Bring Forward, Send Backward)
- [x] Build image embedding into PDF on save (pdf-lib `embedPng`/`embedJpg`)
- [ ] Test: Insert images, move/resize them, save PDF, reopen and verify

## Phase 6: Signature System

- [x] Build `SignatureModal` component with 3 tabs
- [x] **Draw tab:** Fabric.js free drawing canvas in modal
  - [x] Configurable pen color and width
  - [x] Clear button to restart
  - [x] Preview of final signature
- [x] **Type tab:** text input + font selector (script/handwriting fonts)
  - [x] Real-time preview as user types
- [x] **Upload tab:** file dialog for PNG/JPEG/SVG
  - [x] Image preview in modal
- [x] "Apply" button converts to Fabric.js object for placement
- [x] Click-to-place workflow on PDF page
- [x] Implement signature storage in `app.getPath('userData')/signatures/`
- [x] Embed signatures into PDF via pdf-lib on save
- [ ] Test: Create signatures via all 3 methods, save/reload, verify in other readers

## Phase 7: Redaction

- [x] Implement Redact tool — draw rectangles to mark areas for redaction
- [x] Style pending redactions: red border, dashed pattern, semi-transparent
- [ ] Implement text-selection-based redaction (select text → "Redact Selected")
- [ ] Build `RedactionPanel` sidebar — list all pending redactions with page/location
- [x] Allow removing individual pending redactions before applying
- [ ] Build "Apply Redactions" confirmation dialog with irreversibility warning
- [x] Integrate MuPDF.js redaction API
- [ ] Implement redaction fill color option (black, white, custom)
- [ ] Implement optional overlay text on redacted areas
- [ ] Test: Redact text, save, verify text cannot be found in raw PDF bytes

## Phase 8: Save & Export

- [x] Build save pipeline: collect all edits → serialize → apply → write
- [x] Implement operation ordering: redactions → text edits → images → shapes
- [x] Implement "Save" — overwrite original file with confirmation
- [x] Implement "Save As" — native save dialog → new file path
- [ ] Implement "Export Flattened" — all annotations burned into page content
- [ ] Implement post-save integrity verification (reopen + check page count)
- [ ] Handle save errors gracefully: show error message, offer retry or save-as
- [ ] Implement auto-save draft to temp directory (recover on crash)
- [ ] Test: Save with text edits + images + shapes + redactions, verify in Adobe/other viewers

## Phase 9: Polish & UX

- [x] Build menu bar: File (Open, Save, Save As, Export, Recent, Print, Exit)
- [x] Build menu bar: Edit (Undo, Redo, Cut, Copy, Paste, Select All)
- [x] Build menu bar: View (Zoom In/Out, Fit Width, Fit Page, Sidebar Toggle)
- [x] Build menu bar: Tools (Select, Edit Text, Insert Image, Signature, Redact, Shapes submenu)
- [ ] Build menu bar: Help (Keyboard Shortcuts, About)
- [x] Implement drag-and-drop file opening (drop PDF on window)
- [ ] Implement recent files list (stored in localStorage or userData)
- [x] Add loading overlay for PDF open operations
- [x] Add error display toast for failures
- [ ] Implement dark mode / light mode toggle
- [ ] Implement print support (Ctrl+P → system print dialog)
- [ ] Build keyboard shortcuts help dialog
- [x] Set window title to filename
- [ ] Remember window size and position across sessions
- [ ] Add context menus (right-click on objects, on page, on sidebar)
- [ ] Test: Full user workflow — open, edit, draw, sign, redact, save

## Phase 10: Testing & Packaging

- [x] Write unit tests: `CoordinateTransform` (17 tests)
- [x] Write unit tests: `FontMapper` (19 tests)
- [x] Write unit tests: `AnnotationStore` (13 tests)
- [x] Write unit tests: `ToolStore` (11 tests)
- [ ] Write unit tests: Save pipeline (edit collection, operation ordering)
- [ ] Write e2e test: Open PDF → verify page count and rendering
- [ ] Write e2e test: Draw shapes → save → reopen → verify shapes present
- [ ] Write e2e test: Add signature → save → reopen → verify signature
- [ ] Write e2e test: Redact text → save → verify text removed from raw bytes
- [ ] Write e2e test: Edit text → save → reopen → verify new text
- [ ] Test with diverse PDFs (scanned, forms, fonts, large)
- [x] Configure electron-builder for Windows NSIS installer
- [ ] Build production installer and test installation
- [ ] Performance profiling: identify and fix bottlenecks
- [ ] Memory profiling: verify < 500MB for 200-page document
- [ ] Final QA pass: complete user workflow from open to save
