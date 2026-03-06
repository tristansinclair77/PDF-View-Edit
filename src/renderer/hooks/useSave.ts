import { useCallback } from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { useAnnotationStore } from '../stores/annotationStore';

export function useSave() {
  const { filePath, setModified } = useDocumentStore();
  const { pendingRedactions, clearPendingRedactions } = useAnnotationStore();

  const saveDocument = useCallback(async (saveAs: boolean = false) => {
    const docStore = useDocumentStore.getState();
    if (!docStore.documentInfo) return;

    const annStore = useAnnotationStore.getState();

    // Collect all edits from annotation data
    // For now, collect pending redactions
    const redactions = annStore.pendingRedactions.map((r) => ({
      pageNum: r.pageNum,
      rect: r.rect,
      fillColor: r.fillColor,
      overlayText: r.overlayText,
    }));

    try {
      // Apply all edits through the main process
      const editedBuffer = await window.electronAPI.pdfApplyEdits({
        edits: [], // Text edits will be collected from annotation canvas
        images: [], // Image insertions will be collected from annotation canvas
        shapes: [], // Shape drawings will be collected from annotation canvas
        redactions,
      });

      let targetPath: string | null = null;

      if (saveAs || !filePath) {
        targetPath = await window.electronAPI.fileSaveAs({ data: editedBuffer });
      } else {
        const success = await window.electronAPI.fileSave({ path: filePath, data: editedBuffer });
        if (success) {
          targetPath = filePath;
        }
      }

      if (targetPath) {
        setModified(false);
        clearPendingRedactions();
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [filePath, setModified, clearPendingRedactions]);

  return { saveDocument };
}
