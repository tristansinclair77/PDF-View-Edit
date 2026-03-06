import { useEffect } from 'react';
import { useToolStore, ToolType } from '../stores/toolStore';
import { useDocumentStore } from '../stores/documentStore';
import { useAnnotationStore } from '../stores/annotationStore';
import { useSave } from './useSave';

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: 'select',
  t: 'editText',
  l: 'line',
  r: 'rect',
  e: 'ellipse',
  p: 'freehand',
  h: 'highlight',
};

export function useKeyboardShortcuts(): void {
  const { setActiveTool } = useToolStore();
  const { zoomIn, zoomOut, openDocument } = useDocumentStore();
  const { undo, redo } = useAnnotationStore();
  const { saveDocument } = useSave();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'o':
            e.preventDefault();
            openDocument();
            break;
          case 's':
            e.preventDefault();
            saveDocument(e.shiftKey); // Ctrl+Shift+S = Save As
            break;
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
        }
        return;
      }

      // Single-key tool shortcuts (only when no modifier)
      if (!e.altKey && !e.shiftKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          setActiveTool(tool);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, zoomIn, zoomOut, openDocument, undo, redo, saveDocument]);
}
