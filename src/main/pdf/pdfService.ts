import type { PDFDocumentInfo, PageInfo, TextBlock, ImageInfo, RedactionArea, TextEdit, ImageInsert, ShapeInsert } from '../../shared/types';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

let mupdf: any = null;

async function getMuPDF(): Promise<any> {
  if (!mupdf) {
    mupdf = await import('mupdf');
  }
  return mupdf;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (match) {
    return {
      r: parseInt(match[1], 16) / 255,
      g: parseInt(match[2], 16) / 255,
      b: parseInt(match[3], 16) / 255,
    };
  }
  // Try rgb() format
  const rgbMatch = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export class PdfService {
  private document: any = null;
  private documentBuffer: ArrayBuffer | null = null;
  private filePath: string = '';

  async loadDocument(buffer: ArrayBuffer): Promise<PDFDocumentInfo> {
    const mu = await getMuPDF();
    this.documentBuffer = buffer;

    const doc = mu.Document.openDocument(Buffer.from(buffer), 'application/pdf');
    this.document = doc;

    const pageCount = doc.countPages();
    let title = '';
    let author = '';

    try {
      if ('getMetaData' in doc) {
        title = (doc as any).getMetaData('info:Title') || '';
        author = (doc as any).getMetaData('info:Author') || '';
      }
    } catch {
      // metadata extraction is optional
    }

    return {
      pageCount,
      title,
      author,
      filePath: this.filePath,
    };
  }

  async renderPage(pageNum: number, dpi: number): Promise<ArrayBuffer> {
    if (!this.document) throw new Error('No document loaded');

    const mu = await getMuPDF();
    const page = this.document.loadPage(pageNum);
    const scale = dpi / 72;
    const matrix = mu.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mu.ColorSpace.DeviceRGB, false, true);

    const width = pixmap.getWidth();
    const height = pixmap.getHeight();
    const pixels = pixmap.getPixels();

    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = pixels[i * 3];
      rgba[i * 4 + 1] = pixels[i * 3 + 1];
      rgba[i * 4 + 2] = pixels[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }

    const header = new Uint32Array([width, height]);
    const result = new Uint8Array(8 + rgba.byteLength);
    result.set(new Uint8Array(header.buffer), 0);
    result.set(rgba, 8);

    return result.buffer;
  }

  async getPageInfo(pageNum: number): Promise<PageInfo> {
    if (!this.document) throw new Error('No document loaded');

    const page = this.document.loadPage(pageNum);
    const bounds = page.getBounds();

    return {
      pageNum,
      width: bounds[2] - bounds[0],
      height: bounds[3] - bounds[1],
    };
  }

  async extractText(pageNum: number): Promise<TextBlock[]> {
    if (!this.document) throw new Error('No document loaded');

    const page = this.document.loadPage(pageNum);
    const bounds = page.getBounds();
    const originX = bounds[0];
    const originY = bounds[1];
    const blocks: TextBlock[] = [];

    try {
      const stext = page.toStructuredText('preserve-whitespace');

      // Track current run (characters with same font/size/color)
      let runText = '';
      let runFontName = '';
      let runFontSize = 12;
      let runColor = '#000000';
      let runMinX = Infinity;
      let runMinY = Infinity;
      let runMaxX = -Infinity;
      let runMaxY = -Infinity;
      let runBaseline = 0;
      let runFirstVisibleX = Infinity;
      let runLastVisibleMaxX = -Infinity;

      function flushRun(): void {
        const trimmed = runText.trim();
        if (trimmed && isFinite(runMinY)) {
          // Use first/last visible char positions to avoid space-induced offset
          const effectiveMinX = isFinite(runFirstVisibleX) ? runFirstVisibleX : runMinX;
          const effectiveMaxX = isFinite(runLastVisibleMaxX) ? runLastVisibleMaxX : runMaxX;
          blocks.push({
            text: trimmed,
            x: effectiveMinX - originX,
            y: runMinY - originY,
            width: effectiveMaxX - effectiveMinX,
            height: runMaxY - runMinY,
            fontName: runFontName,
            fontSize: runFontSize,
            color: runColor,
            baseline: runBaseline - originY,
          });
        }
        runText = '';
        runMinX = Infinity;
        runMinY = Infinity;
        runMaxX = -Infinity;
        runMaxY = -Infinity;
        runBaseline = 0;
        runFirstVisibleX = Infinity;
        runLastVisibleMaxX = -Infinity;
      }

      function resetRun(): void {
        runText = '';
        runFontName = '';
        runFontSize = 12;
        runColor = '#000000';
        runMinX = Infinity;
        runMinY = Infinity;
        runMaxX = -Infinity;
        runMaxY = -Infinity;
        runBaseline = 0;
        runFirstVisibleX = Infinity;
        runLastVisibleMaxX = -Infinity;
      }

      stext.walk({
        beginLine() {
          resetRun();
        },
        onChar(...rawArgs: unknown[]) {
          const ch = rawArgs[0] as string;
          const origin = rawArgs[1] as number[];
          const font = rawArgs[2] as { getName(): string };
          const size = rawArgs[3] as number;
          const quad = rawArgs[4] as number[];
          const color = rawArgs[5] as number[];

          let fontName = runFontName;
          if (font) {
            try { fontName = font.getName(); } catch { /* ignore */ }
          }
          const fontSize = size || runFontSize;
          let colorStr = runColor;
          if (color && color.length >= 3) {
            colorStr = `rgb(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)})`;
          }

          // If font/size/color changed, flush the current run and start a new one
          if (runText.length > 0 && (fontName !== runFontName || fontSize !== runFontSize || colorStr !== runColor)) {
            flushRun();
          }

          runFontName = fontName;
          runFontSize = fontSize;
          runColor = colorStr;
          runText += ch;

          // Track baseline from character origin
          if (origin && origin.length >= 2) {
            const oy = Number(origin[1]);
            if (isFinite(oy)) runBaseline = oy;
          }

          // Accumulate bbox from character quads
          const isVisible = ch.trim().length > 0;
          if (quad && quad.length >= 8) {
            let charMinX = Infinity;
            let charMaxX = -Infinity;
            for (let i = 0; i < 8; i += 2) {
              const qx = Number(quad[i]);
              const qy = Number(quad[i + 1]);
              if (isFinite(qx) && isFinite(qy)) {
                if (qx < runMinX) runMinX = qx;
                if (qy < runMinY) runMinY = qy;
                if (qx > runMaxX) runMaxX = qx;
                if (qy > runMaxY) runMaxY = qy;
                if (qx < charMinX) charMinX = qx;
                if (qx > charMaxX) charMaxX = qx;
              }
            }
            if (isVisible) {
              if (charMinX < runFirstVisibleX) runFirstVisibleX = charMinX;
              if (charMaxX > runLastVisibleMaxX) runLastVisibleMaxX = charMaxX;
            }
          } else if (origin && origin.length >= 2) {
            const ox = Number(origin[0]);
            const oy = Number(origin[1]);
            if (isFinite(ox) && isFinite(oy)) {
              if (ox < runMinX) runMinX = ox;
              if (oy - size < runMinY) runMinY = oy - size;
              if (ox + size * 0.6 > runMaxX) runMaxX = ox + size * 0.6;
              if (oy > runMaxY) runMaxY = oy;
              if (isVisible) {
                if (ox < runFirstVisibleX) runFirstVisibleX = ox;
                const charEndX = ox + size * 0.6;
                if (charEndX > runLastVisibleMaxX) runLastVisibleMaxX = charEndX;
              }
            }
          }
        },
        endLine() {
          flushRun();
        },
      });
    } catch (err) {
      console.error('Text extraction error:', err);
    }

    return blocks;
  }

  async extractImages(_pageNum: number): Promise<ImageInfo[]> {
    if (!this.document) throw new Error('No document loaded');
    return [];
  }

  async applyRedactions(redactions: RedactionArea[]): Promise<ArrayBuffer> {
    if (!this.document || !this.documentBuffer) throw new Error('No document loaded');

    const mu = await getMuPDF();
    const doc = mu.Document.openDocument(Buffer.from(this.documentBuffer), 'application/pdf') as any;

    for (const redaction of redactions) {
      const page = doc.loadPage(redaction.pageNum);
      if ('addRedaction' in page) {
        (page as any).addRedaction(
          [redaction.rect.x, redaction.rect.y,
           redaction.rect.x + redaction.rect.width,
           redaction.rect.y + redaction.rect.height]
        );
        (page as any).applyRedactions();
      }
    }

    const output = doc.saveToBuffer('incremental');
    return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  }

  async applyEdits(params: {
    edits: TextEdit[];
    images: ImageInsert[];
    shapes: ShapeInsert[];
    redactions: RedactionArea[];
  }): Promise<ArrayBuffer> {
    if (!this.documentBuffer) throw new Error('No document loaded');

    let currentBuffer = new Uint8Array(this.documentBuffer);

    // Step 1: Apply redactions first (via MuPDF)
    if (params.redactions.length > 0) {
      try {
        const mu = await getMuPDF();
        const doc = mu.Document.openDocument(Buffer.from(currentBuffer), 'application/pdf') as any;

        for (const redaction of params.redactions) {
          const page = doc.loadPage(redaction.pageNum);
          if ('addRedaction' in page) {
            (page as any).addRedaction([
              redaction.rect.x,
              redaction.rect.y,
              redaction.rect.x + redaction.rect.width,
              redaction.rect.y + redaction.rect.height,
            ]);
            (page as any).applyRedactions();
          }
        }

        const output = doc.saveToBuffer('');
        currentBuffer = new Uint8Array(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength));
      } catch (err) {
        console.error('Redaction error:', err);
      }
    }

    // Step 2: Apply text edits, images, and shapes via pdf-lib
    const pdfDoc = await PDFDocument.load(currentBuffer);
    const pages = pdfDoc.getPages();

    // Apply text edits (overlay new text over white rect covering original)
    for (const edit of params.edits) {
      const page = pages[edit.pageNum];
      if (!page) continue;

      const { height } = page.getSize();
      const c = hexToRgb(edit.color);

      // Draw white rectangle to cover original text
      page.drawRectangle({
        x: edit.originalRect.x,
        y: height - edit.originalRect.y - edit.originalRect.height,
        width: edit.originalRect.width,
        height: edit.originalRect.height,
        color: rgb(1, 1, 1),
      });

      // Draw new text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(edit.newText, {
        x: edit.originalRect.x,
        y: height - edit.originalRect.y - edit.originalRect.height + 2,
        size: edit.fontSize,
        font,
        color: rgb(c.r, c.g, c.b),
      });
    }

    // Apply image insertions
    for (const img of params.images) {
      const page = pages[img.pageNum];
      if (!page) continue;

      const { height } = page.getSize();
      let embedded;

      if (img.mimeType === 'image/png') {
        embedded = await pdfDoc.embedPng(new Uint8Array(img.imageData));
      } else {
        embedded = await pdfDoc.embedJpg(new Uint8Array(img.imageData));
      }

      page.drawImage(embedded, {
        x: img.x,
        y: height - img.y - img.height,
        width: img.width,
        height: img.height,
      });
    }

    // Apply shape drawings
    for (const shape of params.shapes) {
      const page = pages[shape.pageNum];
      if (!page) continue;

      const { height } = page.getSize();
      const sc = hexToRgb(shape.strokeColor);
      const fc = hexToRgb(shape.fillColor);

      switch (shape.type) {
        case 'rect': {
          const [x, y, w, h] = shape.points;
          page.drawRectangle({
            x,
            y: height - y - h,
            width: w,
            height: h,
            borderColor: rgb(sc.r, sc.g, sc.b),
            borderWidth: shape.strokeWidth,
            color: shape.fillColor !== 'transparent' ? rgb(fc.r, fc.g, fc.b) : undefined,
            opacity: shape.opacity,
          });
          break;
        }
        case 'ellipse': {
          const [cx, cy, rx, ry] = shape.points;
          page.drawEllipse({
            x: cx,
            y: height - cy,
            xScale: rx,
            yScale: ry,
            borderColor: rgb(sc.r, sc.g, sc.b),
            borderWidth: shape.strokeWidth,
            color: shape.fillColor !== 'transparent' ? rgb(fc.r, fc.g, fc.b) : undefined,
            opacity: shape.opacity,
          });
          break;
        }
        case 'line': {
          const [x1, y1, x2, y2] = shape.points;
          page.drawLine({
            start: { x: x1, y: height - y1 },
            end: { x: x2, y: height - y2 },
            color: rgb(sc.r, sc.g, sc.b),
            thickness: shape.strokeWidth,
            opacity: shape.opacity,
          });
          break;
        }
      }
    }

    const savedBytes = await pdfDoc.save();

    // Update internal buffer
    this.documentBuffer = savedBytes.buffer.slice(
      savedBytes.byteOffset,
      savedBytes.byteOffset + savedBytes.byteLength
    );

    return this.documentBuffer;
  }

  getDocumentBuffer(): ArrayBuffer | null {
    return this.documentBuffer;
  }
}
