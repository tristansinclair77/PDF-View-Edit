# Text Editing Overlay Offset Issue

## Problem
When using the "Edit Text" tool, the editable text overlay (Fabric.js IText) appears shifted to the upper-left of where the actual PDF text renders. The white cover rect is also misaligned.

## Root Cause (Confirmed)
**Primary:** Fabric.js 6 changed default `originX`/`originY` from `'left'`/`'top'` to `'center'`/`'center'`. All Fabric objects were being positioned by their center instead of top-left corner. Fix: explicitly set `originX: 'left', originY: 'top'` on all programmatically-created objects.

**Secondary (remaining small offset):** Under investigation — likely font baseline/ascent difference between MuPDF's text bbox (which includes ascent+descent) and Fabric IText rendering.

## Things Tried

### 1. Switched from `asJSON()` to `walk()` API
- **Rationale:** `asJSON()` had text content issues; `walk()` provides character-level data
- **Result:** Text content extraction improved, but coordinates still offset

### 2. Added diagnostic markers (red dot + blue rect)
- **Rationale:** Visualize where the click lands vs where MuPDF reports text position
- **Result:** Confirmed the blue rect (MuPDF bbox) is offset from rendered text. The issue is in the coordinates from MuPDF, not in Fabric.js positioning logic.

### 3. Subtracted page bounds origin from text coordinates
- **Rationale:** `page.getBounds()` can return non-zero origin `[x0, y0, x1, y1]`. If the page's CropBox/MediaBox doesn't start at (0,0), text coordinates need adjustment.
- **Code:** `x: bbox[0] - bounds[0]`, `y: bbox[1] - bounds[1]`
- **Result:** No improvement. Page likely starts at (0,0) so subtraction has no effect.

### 4. Build line bbox from character quads instead of `beginLine` bbox
- **Rationale:** `beginLine(bbox)` may receive bbox as a typed array (Float32Array/Float64Array), causing `Array.isArray(bbox)` to return `false` and defaulting all positions to `[0,0,0,0]`. Character-level quad data (from `onChar`) is more reliable.
- **Code:** Accumulate min/max x/y from each character's quad points `[ulx,uly, urx,ury, llx,lly, lrx,lry]`. Falls back to character origin points if quads unavailable.
- **Result:** No improvement. Logged `beginLine` args — bbox IS a regular Array with valid coordinates (e.g., `[249.64, 77.74, 368.24, 103.74]`). The typed-array theory was wrong.

### 5. Main-process diagnostic logging of walk() callback args
- **Rationale:** Determine exact types and values passed by MuPDF walk() callbacks
- **Result:** All args are regular JS Arrays. beginLine receives `[x0,y0,x1,y1]` Array, onChar receives origin Array, quad Array (8 values), color Array. Data looks correct. Coordinates are in PDF points.

### 6. Renderer-side diagnostic logging
- **Rationale:** Trace the full coordinate pipeline in the renderer: getViewportPoint → pdfX/pdfY → hit test → overlay position
- **Key Data (DPR=1.25, zoom=1):**
  - Click clientXY: (516, 179)
  - Fabric canvas rect: left=200.0, top=90.8, w=612.0, h=792.0
  - viewportPoint: (316.00, 88.20) — matches (516-200, 179-90.8) ✓
  - Text block "Josh Smith": pdfPos (249.64, 77.74), size 118.60x26.00
  - Hit test: click (316, 88.2) IS inside block (249.64–368.24, 77.74–103.74) ✓
  - Overlay placed at: (249.64, 77.74) — correct per coordinates
  - clickVsOverlay: dx=66.36, dy=10.46 — normal (click was center-right of text)
- **Result:** All math checks out. Coordinates are correct in PDF space. The overlay is placed at the text block's top-left. But visually it's still offset from the rendered text.
- **Conclusion:** The issue is NOT in the coordinate math. It must be a canvas alignment issue — the Fabric canvas and MuPDF canvas may not overlap on screen.

### 7. Canvas alignment comparison (MuPDF vs Fabric bounding rects)
- **Rationale:** Directly compare `getBoundingClientRect()` of both canvas elements to check for physical misalignment
- **Code:** Find MuPDF canvas via `closest('[data-page]').querySelector(':scope > canvas')` and compare rects
- **Result:** `offset: dx=0.0, dy=0.0` — PERFECT alignment. Both canvases have identical bounding rects (left=200.0, top=90.8, w=612.0, h=792.0). This rules out canvas misalignment.

### 8. Direct MuPDF canvas pixel markers
- **Rationale:** Draw directly on the MuPDF canvas (bypassing Fabric entirely) to verify coordinates
- **Code:** GREEN dot at click position, RED rect at text block bbox — both drawn on MuPDF canvas in backing-store pixel coordinates (`pos * zoom * dpr`)
- **Expected:** If RED rect outlines the rendered text exactly, the text extraction coordinates are correct and the issue is in Fabric rendering. If RED rect is offset from rendered text, MuPDF's text extraction coordinates don't match its rendering.
- **Result:** GREEN dot and RED rect both align PERFECTLY with the rendered text. This proves MuPDF text extraction coordinates are correct. The issue is 100% in Fabric.js object positioning.
- **Conclusion:** Fabric.js with `enableRetinaScaling` uses a coordinate system that requires DPR multiplication for positions derived from external sources (like PDF coordinates). Mouse-drawn shapes work because both the input (getViewportPoint) and output (object position) are in the same Fabric coordinate space.

### 9. Multiply Fabric overlay positions by DPR
- **Rationale:** Since drawing on MuPDF canvas at `pos * zoom * dpr` is correct, Fabric objects also need `pos * zoom * dpr` instead of `pos * zoom`
- **Code:** `scaledX = hit.x * zoom * dpr`, `scaledY = hit.y * zoom * dpr`, same for width/height/fontSize
- **Result:** Moved in right direction but OVERSHOT. Overlay appeared slightly offset to the right and text was larger. Confirms Fabric's retina scaling is the root cause but multiplying all values by DPR is not the correct fix.

### 10. Disable Fabric.js `enableRetinaScaling`
- **Rationale:** Fabric's retina scaling creates a mismatch between CSS pixels and Fabric's internal coordinate system. With retina scaling disabled, Fabric coords = CSS pixels = PDF coords at zoom=1. Trade-off: slightly less crisp Fabric annotations on HiDPI, but correct positioning.
- **Code:** Added `enableRetinaScaling: false` to FabricCanvas constructor. Reverted DPR multiplication from attempt #9.
- **Result:** Still offset. Overlay shifted upper-left of rendered text, same as before.

### 11. DOM state diagnostics + yellow Fabric rect at click position
- **Rationale:** Compare Fabric object at click coords vs green dot on MuPDF at same CSS coords. Also log full DOM state.
- **Key Data:**
  - Fabric lower canvas: 612×792 attrs, 612px×792px CSS (enableRetinaScaling: false)
  - MuPDF canvas: 765×990 attrs, 100%×100% CSS
  - Bounding rects: identical (x=362.39...)
  - VPT: Array(6), retinaScaling: 1
  - Yellow Fabric rect at click position appeared to overlap green dot on MuPDF → click-derived coordinates map correctly
  - But cover rect + IText at text block position still offset from red rect on MuPDF
- **Result:** Click-position Fabric objects align with MuPDF, but text-block-position objects don't. Paradoxical — same coordinate space, different results.

### 12. Direct canvas drawing diagnostic (magenta rect)
- **Rationale:** Draw directly on Fabric's lower canvas context at text block position, bypassing Fabric objects entirely
- **Code:** `fabricCtx.strokeRect(hit.x * zoom, hit.y * zoom, ...)` directly on lower canvas 2D context
- **Result:** Magenta rect was erased by `canvas.renderAll()` (Fabric redraws entire lower canvas). Could not see it.

### 13. Three-way reference point test at CSS (100, 100)
- **Rationale:** Place identical markers at the SAME CSS position (100, 100) on all three layers:
  1. RED filled square on MuPDF canvas at backing pixel (100*dpr, 100*dpr)
  2. MAGENTA filled square on Fabric's canvas via `after:render` hook at backing pixel (100*dpr, 100*dpr) with `ctx.resetTransform()`
  3. CYAN Fabric Rect object at `left: 100, top: 100`
- **Settings:** `enableRetinaScaling: true` (Fabric canvas = 765×990 backing, 612×792 CSS — matching MuPDF)
- **Expected:** If all three overlap → Fabric objects render at correct CSS pixels. If cyan offset from red+magenta → Fabric object rendering pipeline has a coordinate mapping bug.
- **Result:** Red missing (MuPDF re-rendered over it). Magenta and cyan did NOT overlap perfectly — cyan was offset upper-left. Confirmed Fabric object rendering has a coordinate mapping issue.

### 14. Fix Fabric.js 6 `originX`/`originY` default
- **Rationale:** Fabric.js 6 changed default `originX`/`originY` from `'left'`/`'top'` to `'center'`/`'center'`. This means `left: X, top: Y` positions the object's CENTER at (X, Y), shifting it upper-left by half its dimensions. This explains the consistent upper-left offset.
- **Code:** Added `originX: 'left', originY: 'top'` to cover Rect, IText, and diagnostic cyan Rect.
- **Result:** MAJOR improvement. Overlay now nearly aligned with rendered text at zoom=1. Small residual offset remains — possibly font metrics (ascent/descent) or Fabric's strokeWidth/padding shifting the render slightly.

### 15. Fix annotation objects not scaling with zoom
- **Rationale:** When zoom changes, the Fabric canvas resizes but existing objects stay at their old positions/sizes. Objects placed at zoom=1 don't move when zoom changes to 2x, making them appear small and mispositioned.
- **Code:** In the canvas resize `useEffect`, compute `sx = newWidth / oldWidth` and apply proportional scaling to all existing objects (`left`, `top`, `scaleX`, `scaleY`), then call `setCoords()`.
- **Result:** Works. Overlay tracks correctly at 100% and 150%. Zoom scaling confirmed working.

### 16. Clean up diagnostics and finalize
- **Rationale:** Remove all diagnostic markers (magenta, cyan, red, green dots/rects), console logs, and restore production cover rect color.
- **Changes:** Removed after:render hook, cyan/red test rects, all editText diagnostic logging/drawing from AnnotationCanvas.tsx. Removed console.logs, red/magenta rect drawing from useTextEditing.ts. Restored cover rect fill to `white`. Set IText `padding: 0`.
- **Result:** Done. Clean production code.

## Coordinate Flow
1. MuPDF renders page at `dpi = 72 * zoom * devicePixelRatio`
2. Canvas pixel size = `pageWidth * zoom * dpr` x `pageHeight * zoom * dpr`
3. Canvas CSS size = `pageWidth * zoom` x `pageHeight * zoom`
4. Fabric.js canvas dimensions = `pageWidth * zoom` x `pageHeight * zoom`
5. Click coordinate (`getViewportPoint`) = CSS pixels relative to canvas
6. PDF coordinate = `clickPos / zoom` (should be in 72 DPI PDF points)
7. Text overlay position = `textBlock.x * zoom`, `textBlock.y * zoom` (back to CSS pixels)

## Key Files
- `src/main/pdf/pdfService.ts` — `extractText()` extracts text positions from MuPDF
- `src/renderer/hooks/useTextEditing.ts` — positions Fabric.js overlay at extracted coordinates
- `src/renderer/hooks/usePageRenderer.ts` — renders PDF page via MuPDF
- `src/renderer/components/AnnotationCanvas.tsx` — handles click events, passes to useTextEditing
