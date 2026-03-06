export interface PDFDocumentInfo {
  pageCount: number;
  title: string;
  author: string;
  filePath: string;
}

export interface PageInfo {
  pageNum: number;
  width: number;
  height: number;
}

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  color: string;
  baseline: number;
}

export interface ImageInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionArea {
  pageNum: number;
  rect: Rect;
  fillColor: string;
  overlayText?: string;
}

export interface TextEdit {
  pageNum: number;
  originalRect: Rect;
  newText: string;
  fontName: string;
  fontSize: number;
  color: string;
}

export interface ImageInsert {
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: ArrayBuffer;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface ShapeInsert {
  pageNum: number;
  type: 'line' | 'rect' | 'ellipse' | 'arrow' | 'path';
  points: number[];
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface SavedSignature {
  id: string;
  name: string;
  imageDataUrl: string;
  createdAt: number;
}

export interface ElectronAPI {
  fileOpen: () => Promise<{ buffer: ArrayBuffer; path: string } | null>;
  fileOpenPath: (filePath: string) => Promise<{ buffer: ArrayBuffer; path: string } | null>;
  fileSave: (params: { path: string; data: ArrayBuffer }) => Promise<boolean>;
  fileSaveAs: (params: { data: ArrayBuffer }) => Promise<string | null>;
  pdfLoad: (buffer: ArrayBuffer) => Promise<PDFDocumentInfo>;
  pdfRenderPage: (params: { pageNum: number; dpi: number }) => Promise<ArrayBuffer>;
  pdfGetPageInfo: (pageNum: number) => Promise<PageInfo>;
  pdfExtractText: (params: { pageNum: number; rect?: Rect }) => Promise<TextBlock[]>;
  pdfExtractImages: (pageNum: number) => Promise<ImageInfo[]>;
  pdfApplyRedactions: (redactions: RedactionArea[]) => Promise<ArrayBuffer>;
  pdfApplyEdits: (params: {
    edits: TextEdit[];
    images: ImageInsert[];
    shapes: ShapeInsert[];
    redactions: RedactionArea[];
  }) => Promise<ArrayBuffer>;
  signatureSave: (data: { name: string; imageData: string }) => Promise<void>;
  signatureList: () => Promise<SavedSignature[]>;
  signatureDelete: (id: string) => Promise<void>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
