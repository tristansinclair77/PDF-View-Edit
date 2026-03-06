# PDF View & Edit — Implementation Plan

## 1. Project Vision

Build a desktop PDF viewer and editor that:
- Loads any PDF with **perfect 1:1 fidelity** (fonts, text, layout, images)
- Allows **in-place text editing** while preserving original formatting
- Supports **image insertion and replacement**
- Provides **digital signature** capabilities (draw, type, upload)
- Implements **secure redaction** that permanently removes content
- Offers a full **drawing toolkit** (lines, shapes, colors, fills)
- Saves modified PDFs that other readers can open normally

---

## 2. Technology Stack & Justification

### Core Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Desktop Shell | **Electron 33+** | Mature, full Node.js access, consistent Chromium rendering across platforms |
| UI Framework | **React 18 + TypeScript** | Component-based UI, strong typing, massive ecosystem |
| State Management | **Zustand** | Lightweight, no boilerplate, works naturally with React |
| PDF Rendering | **MuPDF.js** (WASM) | #1 ranked open-source rendering fidelity, built-in annotation/redaction APIs |
| PDF Content Editing | **pdf-lib** | Pure JS, MIT licensed, excellent for adding text/images/drawing to PDFs |
| Annotation Canvas | **Fabric.js 6** | Object-oriented canvas, built-in free drawing, shape manipulation, text editing |
| Build (Renderer) | **Vite** | Fast HMR, native TypeScript support |
| Build (Electron) | **electron-builder** | Cross-platform packaging, auto-update support |
| Testing | **Vitest** + **Playwright** | Fast unit tests + real browser e2e tests |

### Architecture: Dual-Canvas Layered Rendering

```
┌──────────────────────────────────────────────────┐
│                  Electron Window                  │
│  ┌──────────────────────────────────────────────┐│
│  │              React Application               ││
│  │  ┌────────────────────────────────────────┐  ││
│  │  │           Toolbar / Ribbon             │  ││
│  │  ├────────┬───────────────────────────────┤  ││
│  │  │ Side   │      Page Viewport            │  ││
│  │  │ Panel  │  ┌─────────────────────────┐  │  ││
│  │  │        │  │  Layer 1: MuPDF Canvas  │  │  ││
│  │  │ - Page │  │  (PDF raster render)    │  │  ││
│  │  │   List │  ├─────────────────────────┤  │  ││
│  │  │ - Prop │  │  Layer 2: Fabric.js     │  │  ││
│  │  │   Panel│  │  (interactive overlay)  │  │  ││
│  │  │        │  └─────────────────────────┘  │  ││
│  │  └────────┴───────────────────────────────┘  ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │          Main Process (Node.js)              ││
│  │  MuPDF.js WASM  |  pdf-lib  |  File I/O     ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

**How it works:**
1. MuPDF.js renders each PDF page to a canvas at the target DPI — this is the "ground truth" view
2. A transparent Fabric.js canvas sits directly on top, pixel-aligned
3. All user interactions (drawing, selecting, editing) happen on the Fabric.js layer
4. The MuPDF canvas is read-only and re-renders when zoom/page changes
5. On save, Fabric.js objects are converted to PDF operations and merged into the document

---

## 3. Feature Specifications

### 3.1 PDF Loading & Rendering

**Goal:** Open any valid PDF and display it with perfect visual fidelity.

**Implementation:**
- User opens a file via native file dialog (Electron `dialog.showOpenDialog`)
- Main process reads the file as `ArrayBuffer` and loads it into MuPDF.js
- MuPDF.js parses the document and reports page count, dimensions, metadata
- Renderer receives document info via IPC and creates a scrollable page list
- Each visible page is rendered by MuPDF.js to an `OffscreenCanvas` or `ImageBitmap`
- Pages are rendered at `window.devicePixelRatio * zoom` DPI for sharp display
- Lazy rendering: only pages in/near the viewport are rendered (IntersectionObserver)
- Page cache: keep 10 pages in memory (LRU eviction)

**Zoom & Navigation:**
- Zoom levels: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 400%, fit-width, fit-page
- Keyboard shortcuts: Ctrl+/- for zoom, Page Up/Down for navigation, Ctrl+G for go-to-page
- Scroll-based page navigation with smooth scrolling
- Page thumbnails in sidebar for quick navigation

### 3.2 Text Editing

**Goal:** Click on any text in the PDF, edit it in-place, and save with formatting preserved.

**Implementation — Overlay Editing with Redact-and-Replace Save:**

**Entering Edit Mode:**
1. User activates "Edit Text" tool from toolbar
2. User clicks on a text region in the PDF
3. MuPDF.js extracts text content and font metrics from that region:
   - Text string, font name, font size, color, character spacing
   - Bounding box in PDF coordinate space
4. A Fabric.js `IText` (interactive text) object is created at the exact position
5. The object is styled to match: same font family (mapped to closest web font or embedded font), same size, same color
6. User edits the text directly on the Fabric.js canvas
7. Visual indicator (blue border) shows the editable region

**Saving Text Edits:**
1. For each modified text region, record: original bbox, new text content, font metrics
2. Use MuPDF.js redaction API to remove the original text from the content stream within the bbox
3. Use pdf-lib to insert new text at the same position with matched font/size/color
4. If the original font is embedded in the PDF, extract and re-embed it via pdf-lib's fontkit

**Font Matching Strategy:**
- Extract font name from MuPDF's text extraction
- Map to system fonts or bundled fonts (bundle the 14 standard PDF fonts + a few common ones)
- If exact font unavailable, use closest visual match and warn the user
- Store font mapping decisions for consistency within a document

### 3.3 Image Editing

**Goal:** Add new images, replace existing images, move/resize images.

**Implementation:**

**Adding Images:**
1. User activates "Insert Image" tool
2. File dialog opens (supports PNG, JPEG, SVG, TIFF, BMP, WebP)
3. Selected image is loaded as a Fabric.js `Image` object on the annotation canvas
4. User positions and resizes the image using Fabric.js handles
5. On save, image is embedded into the PDF via pdf-lib (`PDFDocument.embedPng/embedJpg`)

**Editing Existing Images:**
1. MuPDF.js extracts images from the page with their positions and dimensions
2. When user clicks on an image region, a Fabric.js `Image` object is created from the extracted image data
3. User can move, resize, rotate, or replace the image
4. Replacement: user selects new image file, it swaps in at the same position/size
5. On save: original image is redacted (MuPDF), new image is embedded (pdf-lib)

**Image Operations:**
- Move (drag)
- Resize (corner/edge handles, maintain aspect ratio with Shift)
- Rotate (rotation handle)
- Replace (right-click > Replace Image)
- Delete (Delete key or right-click > Delete)
- Bring forward / Send backward (layer ordering)

### 3.4 Signature System

**Goal:** Add signatures to PDFs via drawing, typing, or uploading an image.

**Three Signature Modes:**

**Mode 1 — Draw:**
1. User clicks "Add Signature" > "Draw"
2. A modal opens with a blank canvas (Fabric.js free drawing mode)
3. User draws their signature with mouse/stylus
4. Configurable: pen color (default black), pen width
5. User clicks "Apply" — the drawing is converted to a Fabric.js `Path` group
6. User places the signature on the PDF page by clicking

**Mode 2 — Type:**
1. User clicks "Add Signature" > "Type"
2. A modal opens with a text input and font selector
3. Available fonts: 4-6 script/handwriting fonts bundled with the app
4. User types their name, selects a font, optionally adjusts size
5. Preview updates in real-time
6. User clicks "Apply" — creates a Fabric.js `Text` object with the script font
7. User places it on the PDF page

**Mode 3 — Upload:**
1. User clicks "Add Signature" > "Upload Image"
2. File dialog opens (PNG, JPEG, SVG with transparency support)
3. Image is loaded and displayed in a preview modal
4. Optional: background removal for images without transparency
5. User clicks "Apply" — creates a Fabric.js `Image` object
6. User places it on the PDF page

**Signature Storage:**
- Saved signatures are stored in the app's local data directory (`app.getPath('userData')`)
- Stored as PNG images with transparency
- User can manage saved signatures (view, delete) from a signature gallery
- Saved signatures can be quickly re-applied to any document

**Saving Signatures to PDF:**
- Signatures are rasterized to PNG (at 300 DPI for print quality)
- Embedded into the PDF via pdf-lib as images
- Positioned at the exact PDF coordinates where the user placed them

### 3.5 Redaction

**Goal:** Permanently and irrecoverably remove sensitive information from PDFs.

**Implementation — MuPDF Secure Redaction:**

**User Workflow:**
1. User activates "Redact" tool from toolbar
2. User draws rectangles over areas to redact (Fabric.js rect objects, styled with red border + diagonal lines pattern to indicate pending redaction)
3. User can also select text to redact (text selection mode)
4. Pending redactions are displayed as visual markers but content is still visible
5. User reviews all pending redactions in a sidebar list
6. User clicks "Apply Redactions" — confirmation dialog warns this is irreversible
7. After confirmation, redactions are applied

**Redaction Process:**
1. For each redaction rectangle, create a MuPDF redaction annotation at those PDF coordinates
2. Call MuPDF's `applyRedactions()` — this:
   - Removes all text characters whose bounding boxes intersect the redaction area
   - Removes all vector graphics and images that intersect the redaction area
   - Fills the area with the specified color (default: black rectangle)
3. Strip incremental updates from the saved PDF (prevents recovering original content from the update history)
4. Verify: search the output PDF byte stream for any remnant of the redacted text

**Redaction Options:**
- Fill color: black (default), white, or custom color
- Overlay text: optional text to display on redacted area (e.g., "REDACTED")
- Scope: selected area, selected text, or entire page

**Security Guarantees:**
- Content is removed from the PDF content stream, not just visually hidden
- Incremental save data is stripped to prevent forensic recovery
- Metadata that references redacted content is also cleaned
- Post-redaction verification is performed automatically

### 3.6 Drawing Tools (Lines, Shapes, Colors)

**Goal:** Draw lines, shapes, and freehand annotations with full color control.

**Available Tools:**

| Tool | Fabric.js Object | Properties |
|------|-----------------|------------|
| Line | `Line` | start/end points, color, width, dash pattern |
| Arrow | `Line` + `Triangle` (grouped) | direction, color, width |
| Rectangle | `Rect` | position, size, fill, stroke, corner radius |
| Ellipse | `Ellipse` | position, rx, ry, fill, stroke |
| Polygon | `Polygon` | vertices, fill, stroke |
| Freehand | `Path` (free drawing mode) | color, width, smoothing |
| Text Box | `IText` | font, size, color, bold, italic, alignment |
| Highlight | `Rect` (semi-transparent) | color, opacity (default: yellow, 40%) |
| Strikethrough | `Line` (positioned over text) | color, width |
| Underline | `Line` (positioned under text) | color, width |

**Color System:**
- Color picker with: preset swatches (12 common colors), hex input, RGB sliders, opacity slider
- Separate controls for stroke (outline) color and fill color
- Recent colors palette (last 8 used colors)
- Eyedropper tool to sample colors from the PDF

**Shape Properties Panel:**
- Stroke width: 0.5px to 20px slider
- Stroke style: solid, dashed, dotted
- Fill: solid color, no fill, or semi-transparent
- Opacity: 0% to 100% slider
- Corner radius (rectangles only)
- Arrow heads (lines only): none, start, end, both

**Interaction:**
- Click and drag to create shapes
- Click to select existing shapes
- Drag handles to resize
- Rotation handle to rotate
- Multi-select with Shift+click or drag selection box
- Delete with Delete/Backspace key
- Copy/Paste with Ctrl+C/Ctrl+V
- Undo/Redo with Ctrl+Z/Ctrl+Y (annotation-level undo stack)
- Keyboard nudge: arrow keys move selected object 1px, Shift+arrow moves 10px

### 3.7 Saving & Export

**Save Workflow:**
1. User clicks "Save" (Ctrl+S) or "Save As" (Ctrl+Shift+S)
2. System collects all modifications:
   - Text edits → redact original + insert new text
   - New images → embed into page
   - Signatures → rasterize and embed as images
   - Shapes/drawings → convert to PDF annotations or embed as vector content
   - Redactions → apply MuPDF redaction
3. Operations are applied in order:
   a. Redactions first (removes content)
   b. New content second (text, images, shapes)
   c. Annotations third (non-flattened annotations if desired)
4. PDF is written to the target file
5. Post-save verification: re-open and check page count, file integrity

**Save Options:**
- **Save:** Overwrites original file (with confirmation if first save)
- **Save As:** Choose new file path
- **Export Flattened:** All annotations burned into content (non-editable)
- **Export with Annotations:** Annotations preserved as PDF annotation objects (editable in other readers)

---

## 4. UI Layout Design

```
┌─────────────────────────────────────────────────────────────────┐
│  File   Edit   View   Tools   Help                    [_][□][X] │
├─────────────────────────────────────────────────────────────────┤
│ [Open][Save][SaveAs] | [Undo][Redo] | [ZoomOut][100%][ZoomIn]  │
│ ─────────────────────────────────────────────────────────────── │
│ [Select][EditText][AddImage][Signature][Redact] | [Shapes ▾]   │
│ [Line][Arrow][Rect][Ellipse][Freehand][TextBox] | [Color ◉][▤] │
├────────┬────────────────────────────────────────┬───────────────┤
│ Pages  │                                        │  Properties   │
│        │                                        │               │
│ ┌────┐ │     ┌──────────────────────────┐       │  Stroke: ──── │
│ │ 1  │ │     │                          │       │  Color: [■]   │
│ └────┘ │     │                          │       │  Width: 2px   │
│ ┌────┐ │     │      PDF Page View       │       │               │
│ │ 2  │ │     │                          │       │  Fill: ────── │
│ └────┘ │     │   (MuPDF + Fabric.js)    │       │  Color: [□]   │
│ ┌────┐ │     │                          │       │  Opacity: 100 │
│ │ 3  │ │     │                          │       │               │
│ └────┘ │     └──────────────────────────┘       │  Position:    │
│        │                                        │  X: 100 Y: 50 │
│ ┌────┐ │     ┌──────────────────────────┐       │  W: 200 H:100 │
│ │ 4  │ │     │      PDF Page View       │       │               │
│ └────┘ │     │                          │       │  Rotation: 0° │
│        │     └──────────────────────────┘       │               │
├────────┴────────────────────────────────┴───────────────────────┤
│  Page 1 of 12  |  100%  |  Modified                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. IPC Communication Design

All communication between main and renderer processes uses typed IPC channels:

```typescript
// Shared IPC channel types
interface IPCChannels {
  // File operations
  'file:open': () => Promise<{ buffer: ArrayBuffer; path: string } | null>;
  'file:save': (params: { path: string; data: ArrayBuffer }) => Promise<boolean>;
  'file:save-as': (params: { data: ArrayBuffer }) => Promise<string | null>;

  // PDF operations (MuPDF in main process)
  'pdf:load': (buffer: ArrayBuffer) => Promise<PDFDocumentInfo>;
  'pdf:render-page': (params: { pageNum: number; dpi: number }) => Promise<ImageBitmap>;
  'pdf:extract-text': (params: { pageNum: number; rect?: Rect }) => Promise<TextBlock[]>;
  'pdf:extract-images': (pageNum: number) => Promise<ImageInfo[]>;
  'pdf:apply-redactions': (redactions: RedactionArea[]) => Promise<ArrayBuffer>;
  'pdf:get-page-info': (pageNum: number) => Promise<PageInfo>;

  // Save operations
  'pdf:apply-edits': (params: {
    edits: TextEdit[];
    images: ImageInsert[];
    shapes: ShapeInsert[];
    redactions: RedactionArea[];
  }) => Promise<ArrayBuffer>;

  // Signature storage
  'signature:save': (data: { name: string; imageData: string }) => Promise<void>;
  'signature:list': () => Promise<SavedSignature[]>;
  'signature:delete': (id: string) => Promise<void>;
}
```

---

## 6. State Management Design (Zustand)

```typescript
// Core stores
interface DocumentStore {
  filePath: string | null;
  pageCount: number;
  currentPage: number;
  zoom: number;
  isModified: boolean;
  // actions
  openDocument: (path: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
}

interface ToolStore {
  activeTool: ToolType; // 'select' | 'editText' | 'addImage' | 'signature' | 'redact' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'freehand' | 'textBox'
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  // actions
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  // ...etc
}

interface AnnotationStore {
  // per-page annotation state
  annotations: Map<number, FabricObject[]>;
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];
  pendingRedactions: RedactionArea[];
  // actions
  addAnnotation: (pageNum: number, obj: FabricObject) => void;
  removeAnnotation: (pageNum: number, id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

---

## 7. Implementation Phases

### Phase 1 — Project Scaffolding & PDF Viewing (Foundation)
**Goal:** Working Electron app that opens and renders PDFs with MuPDF.js.

- Initialize Electron + Vite + React + TypeScript project
- Configure electron-builder for dev and production builds
- Set up MuPDF.js WASM loading in main process
- Implement file open dialog and PDF loading IPC
- Build scrollable page view with MuPDF rendering
- Add page thumbnails sidebar
- Implement zoom controls (fit-width, fit-page, manual %)
- Add keyboard navigation (Page Up/Down, Ctrl+G)
- Implement lazy page rendering with IntersectionObserver
- Add LRU page cache (10 pages)

### Phase 2 — Fabric.js Annotation Layer
**Goal:** Interactive transparent canvas overlay on each page for drawing/selection.

- Initialize Fabric.js canvas overlay per visible page
- Implement coordinate system transform (screen ↔ PDF coordinates)
- Handle zoom synchronization between MuPDF canvas and Fabric.js canvas
- Implement object selection tool (click to select, handles for resize/rotate)
- Build undo/redo system for annotations
- Add copy/paste for annotation objects
- Implement multi-select (Shift+click, drag selection box)

### Phase 3 — Drawing Tools
**Goal:** Full shape and line drawing toolkit with color controls.

- Implement line tool (click-drag to draw)
- Implement arrow tool (line + arrowhead)
- Implement rectangle tool
- Implement ellipse tool
- Implement freehand drawing (Fabric.js free drawing mode)
- Implement text box tool (click to place, type to fill)
- Build color picker component (swatches, hex, RGB, opacity)
- Build properties panel (stroke, fill, width, opacity, dash style)
- Implement highlight tool (semi-transparent rectangle)
- Add keyboard shortcuts for tool switching

### Phase 4 — Text Editing
**Goal:** Click on existing PDF text, edit in-place, save with formatting preserved.

- Implement text extraction from MuPDF.js (per-block with font metrics)
- Build text region detection (click to identify text block)
- Create Fabric.js IText overlay positioned on original text
- Map PDF fonts to available system/bundled fonts
- Handle text edit completion → store edit record
- Implement redact-and-replace save for text edits
- Bundle standard PDF fonts (14 base fonts + common extras)
- Add font matching quality indicator

### Phase 5 — Image Operations
**Goal:** Insert, move, resize, replace, and delete images.

- Implement image insertion (file dialog → Fabric.js Image object)
- Support PNG, JPEG, SVG, WebP, BMP, TIFF input formats
- Implement image move/resize/rotate on canvas
- Extract existing images from PDF via MuPDF.js
- Implement image replacement workflow
- Implement image deletion
- Add image layer ordering (bring forward/send backward)
- Implement image embedding into PDF on save via pdf-lib

### Phase 6 — Signature System
**Goal:** Draw, type, or upload signatures and place them on PDFs.

- Build signature modal component with 3 tabs (Draw, Type, Upload)
- Implement draw tab: Fabric.js free drawing in modal canvas
- Implement type tab: text input + script font selector + preview
- Implement upload tab: file dialog + image preview + optional bg removal
- Convert signature to Fabric.js object for placement
- Implement signature placement (click on page to place)
- Build signature storage system (save to userData directory)
- Build signature gallery (list saved, delete, quick-apply)
- Rasterize signatures to 300 DPI PNG for PDF embedding

### Phase 7 — Redaction
**Goal:** Secure, permanent content removal from PDFs.

- Implement redaction tool (draw rectangles over content)
- Style pending redactions (red border, diagonal hatch pattern)
- Implement text-selection-based redaction
- Build redaction review sidebar (list all pending)
- Implement "Apply Redactions" with confirmation dialog
- Integrate MuPDF.js redaction API (create annotation → apply → strip incremental)
- Add redaction options (fill color, overlay text)
- Implement post-redaction verification (byte-level search for removed content)
- Ensure saved PDFs have no recoverable traces

### Phase 8 — Save & Export
**Goal:** Save all modifications back into a valid PDF file.

- Implement save pipeline: collect all edits → apply in order → write PDF
- Order of operations: redactions → text edits → images → shapes → annotations
- Implement "Save" (overwrite) with confirmation
- Implement "Save As" (new file)
- Implement "Export Flattened" (all annotations burned into content)
- Implement "Export with Annotations" (preserve annotation objects)
- Add post-save integrity verification
- Handle save errors gracefully with recovery options

### Phase 9 — Polish & UX
**Goal:** Production-quality user experience.

- Add menu bar (File, Edit, View, Tools, Help) with accelerators
- Implement drag-and-drop file opening
- Add recent files list
- Build toast notification system for success/error messages
- Add loading spinners and progress bars for long operations
- Implement dark mode / light mode toggle
- Add print support (Ctrl+P)
- Keyboard shortcut help dialog
- Window title shows filename and modified state
- Remember window size/position across sessions

### Phase 10 — Testing & Packaging
**Goal:** Reliable, distributable application.

- Write unit tests for coordinate transforms, font matching, state stores
- Write unit tests for PDF save pipeline
- Write e2e tests with Playwright: open file, draw shape, save, verify
- Write e2e tests for redaction security (verify content removal)
- Test with diverse PDFs: scanned, form-heavy, font-heavy, image-heavy, encrypted
- Cross-platform testing (Windows primary, macOS/Linux if applicable)
- Configure electron-builder for Windows installer (NSIS)
- Set up auto-update infrastructure (optional)
- Performance profiling and optimization
- Final QA pass

---

## 8. Key Technical Challenges & Solutions

### Challenge 1: MuPDF.js WASM Loading in Electron
**Problem:** WASM modules need special handling in Electron's main process.
**Solution:** Load MuPDF WASM as a Node.js module in main process. Use `--experimental-wasm-modules` flag or load via `fs.readFile` + `WebAssembly.instantiate`. Pre-build the WASM binary and include in app resources.

### Challenge 2: Fabric.js ↔ PDF Coordinate Mapping
**Problem:** Fabric.js uses screen pixels; PDFs use points (1/72 inch) with origin at bottom-left.
**Solution:** Build a `CoordinateTransform` class that converts between coordinate systems using the page's MediaBox, current zoom level, and device pixel ratio. All Fabric.js objects store their position in PDF coordinates internally.

### Challenge 3: Font Fidelity During Text Editing
**Problem:** Edited text must match the original font exactly.
**Solution:**
1. MuPDF extracts the font name and metrics from the original text
2. Bundle the 14 standard PDF fonts + 20 common fonts (Liberation, DejaVu, Noto families)
3. If exact font not found, use a metric-compatible substitute and warn user
4. Store font data as part of the edit record for consistent re-rendering

### Challenge 4: Redaction Security
**Problem:** Visual-only redaction is not secure — content can be recovered.
**Solution:** MuPDF's `applyRedactions()` removes content at the PDF object level. Additionally, re-save the PDF without incremental updates to eliminate the update history. Post-process verification scans the raw bytes for any trace of redacted strings.

### Challenge 5: Performance with Large PDFs
**Problem:** 200+ page documents with many annotations could be slow.
**Solution:**
- Lazy rendering: only render visible pages + small buffer
- LRU page cache with configurable memory limit
- Fabric.js canvases only active for visible pages (others serialized to JSON)
- Web Workers for heavy PDF operations (rendering, saving)
- Debounce zoom/scroll re-renders

---

## 9. File Size & Dependency Budget

| Dependency | Estimated Size | Purpose |
|-----------|---------------|---------|
| Electron | ~85MB | Desktop shell + Chromium |
| MuPDF WASM | ~15MB | PDF engine |
| React + ReactDOM | ~130KB | UI framework |
| Fabric.js | ~300KB | Canvas library |
| pdf-lib | ~450KB | PDF content editing |
| Zustand | ~10KB | State management |
| Bundled fonts | ~20MB | Font matching for text editing |
| **Total installer** | **~130MB** | |

---

## 10. Security Model

1. **Electron hardening:** contextIsolation=true, nodeIntegration=false, sandbox=true
2. **CSP headers:** restrict script-src to 'self', no inline scripts
3. **File access:** All file operations go through IPC, renderer has no direct fs access
4. **Redaction:** MuPDF content-stream-level removal + incremental-update stripping
5. **No network:** Application works entirely offline, no telemetry, no external calls
6. **Input validation:** All IPC parameters validated with Zod schemas in main process
