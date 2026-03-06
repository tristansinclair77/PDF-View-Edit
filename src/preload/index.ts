import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const electronAPI: ElectronAPI = {
  fileOpen: () => ipcRenderer.invoke('file:open'),
  fileOpenPath: (filePath) => ipcRenderer.invoke('file:open-path', filePath),
  fileSave: (params) => ipcRenderer.invoke('file:save', params),
  fileSaveAs: (params) => ipcRenderer.invoke('file:save-as', params),

  pdfLoad: (buffer) => ipcRenderer.invoke('pdf:load', buffer),
  pdfRenderPage: (params) => ipcRenderer.invoke('pdf:render-page', params),
  pdfGetPageInfo: (pageNum) => ipcRenderer.invoke('pdf:get-page-info', pageNum),
  pdfExtractText: (params) => ipcRenderer.invoke('pdf:extract-text', params),
  pdfExtractImages: (pageNum) => ipcRenderer.invoke('pdf:extract-images', pageNum),
  pdfApplyRedactions: (redactions) => ipcRenderer.invoke('pdf:apply-redactions', redactions),
  pdfApplyEdits: (params) => ipcRenderer.invoke('pdf:apply-edits', params),

  signatureSave: (data) => ipcRenderer.invoke('signature:save', data),
  signatureList: () => ipcRenderer.invoke('signature:list'),
  signatureDelete: (id) => ipcRenderer.invoke('signature:delete', id),

  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
