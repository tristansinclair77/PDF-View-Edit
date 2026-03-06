import { create } from 'zustand';
import type { PDFDocumentInfo, PageInfo } from '../../shared/types';

interface DocumentState {
  filePath: string | null;
  documentInfo: PDFDocumentInfo | null;
  pageInfos: Map<number, PageInfo>;
  currentPage: number;
  zoom: number;
  isModified: boolean;
  isLoading: boolean;
  error: string | null;

  openDocument: () => Promise<void>;
  openDocumentByPath: (filePath: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: (containerWidth: number) => void;
  fitPage: (containerWidth: number, containerHeight: number) => void;
  setModified: (modified: boolean) => void;
  loadPageInfo: (pageNum: number) => Promise<PageInfo>;
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

export const useDocumentStore = create<DocumentState>((set, get) => ({
  filePath: null,
  documentInfo: null,
  pageInfos: new Map(),
  currentPage: 0,
  zoom: 1.0,
  isModified: false,
  isLoading: false,
  error: null,

  openDocument: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.fileOpen();
      if (!result) {
        set({ isLoading: false });
        return;
      }

      const docInfo = await window.electronAPI.pdfLoad(result.buffer);
      docInfo.filePath = result.path;

      set({
        documentInfo: docInfo,
        filePath: result.path,
        currentPage: 0,
        isModified: false,
        isLoading: false,
        pageInfos: new Map(),
        error: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to open document',
      });
    }
  },

  openDocumentByPath: async (filePath: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.fileOpenPath(filePath);
      if (!result) {
        set({ isLoading: false, error: 'Failed to open file' });
        return;
      }

      const docInfo = await window.electronAPI.pdfLoad(result.buffer);
      docInfo.filePath = result.path;

      set({
        documentInfo: docInfo,
        filePath: result.path,
        currentPage: 0,
        isModified: false,
        isLoading: false,
        pageInfos: new Map(),
        error: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to open document',
      });
    }
  },

  setCurrentPage: (page) => {
    const { documentInfo } = get();
    if (!documentInfo) return;
    const clamped = Math.max(0, Math.min(page, documentInfo.pageCount - 1));
    set({ currentPage: clamped });
  },

  setZoom: (zoom) => {
    set({ zoom: Math.max(0.1, Math.min(10, zoom)) });
  },

  zoomIn: () => {
    const { zoom } = get();
    const nextLevel = ZOOM_LEVELS.find((z) => z > zoom + 0.01);
    set({ zoom: nextLevel ?? Math.min(zoom * 1.25, 10) });
  },

  zoomOut: () => {
    const { zoom } = get();
    const prevLevel = [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.01);
    set({ zoom: prevLevel ?? Math.max(zoom / 1.25, 0.1) });
  },

  fitWidth: (containerWidth) => {
    const { pageInfos, currentPage } = get();
    const info = pageInfos.get(currentPage);
    if (!info) return;
    const zoom = (containerWidth - 40) / info.width;
    set({ zoom });
  },

  fitPage: (containerWidth, containerHeight) => {
    const { pageInfos, currentPage } = get();
    const info = pageInfos.get(currentPage);
    if (!info) return;
    const zoomW = (containerWidth - 40) / info.width;
    const zoomH = (containerHeight - 40) / info.height;
    set({ zoom: Math.min(zoomW, zoomH) });
  },

  setModified: (modified) => set({ isModified: modified }),

  loadPageInfo: async (pageNum) => {
    const { pageInfos } = get();
    const cached = pageInfos.get(pageNum);
    if (cached) return cached;

    const info = await window.electronAPI.pdfGetPageInfo(pageNum);
    const newMap = new Map(get().pageInfos);
    newMap.set(pageNum, info);
    set({ pageInfos: newMap });
    return info;
  },
}));
