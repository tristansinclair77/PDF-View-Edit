import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { PdfService } from '../pdf/pdfService';

const pdfService = new PdfService();

export function registerIpcHandlers(): void {
  ipcMain.handle('file:open', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return {
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      path: filePath,
    };
  });

  ipcMain.handle('file:open-path', async (_event, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return {
        buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        path: filePath,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('file:save', async (_event, params: { path: string; data: ArrayBuffer }) => {
    try {
      fs.writeFileSync(params.path, Buffer.from(params.data));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('file:save-as', async (_event, params: { data: ArrayBuffer }) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      defaultPath: 'document.pdf',
    });

    if (result.canceled || !result.filePath) return null;

    fs.writeFileSync(result.filePath, Buffer.from(params.data));
    return result.filePath;
  });

  ipcMain.handle('pdf:load', async (_event, buffer: ArrayBuffer) => {
    return pdfService.loadDocument(buffer);
  });

  ipcMain.handle('pdf:render-page', async (_event, params: { pageNum: number; dpi: number }) => {
    return pdfService.renderPage(params.pageNum, params.dpi);
  });

  ipcMain.handle('pdf:get-page-info', async (_event, pageNum: number) => {
    return pdfService.getPageInfo(pageNum);
  });

  ipcMain.handle('pdf:extract-text', async (_event, params: { pageNum: number }) => {
    return pdfService.extractText(params.pageNum);
  });

  ipcMain.handle('pdf:extract-images', async (_event, pageNum: number) => {
    return pdfService.extractImages(pageNum);
  });

  ipcMain.handle('pdf:apply-redactions', async (_event, redactions) => {
    return pdfService.applyRedactions(redactions);
  });

  ipcMain.handle('pdf:apply-edits', async (_event, params) => {
    return pdfService.applyEdits(params);
  });

  // Signature storage
  ipcMain.handle('signature:save', async (_event, data: { name: string; imageData: string }) => {
    const sigDir = getSignatureDir();
    const id = `sig_${Date.now()}`;
    const sigPath = path.join(sigDir, `${id}.json`);
    fs.writeFileSync(sigPath, JSON.stringify({ id, ...data, createdAt: Date.now() }));
  });

  ipcMain.handle('signature:list', async () => {
    const sigDir = getSignatureDir();
    if (!fs.existsSync(sigDir)) return [];

    const files = fs.readdirSync(sigDir).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      const content = fs.readFileSync(path.join(sigDir, f), 'utf-8');
      return JSON.parse(content);
    });
  });

  ipcMain.handle('signature:delete', async (_event, id: string) => {
    const sigDir = getSignatureDir();
    const sigPath = path.join(sigDir, `${id}.json`);
    if (fs.existsSync(sigPath)) fs.unlinkSync(sigPath);
  });
}

function getSignatureDir(): string {
  const { app } = require('electron');
  const dir = path.join(app.getPath('userData'), 'signatures');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
