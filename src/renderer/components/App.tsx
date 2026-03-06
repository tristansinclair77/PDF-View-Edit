import React, { useEffect, useCallback, useRef } from 'react';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { PageList } from './PageList';
import { StatusBar } from './StatusBar';
import { PropertiesPanel } from './PropertiesPanel';
import { useDocumentStore } from '../stores/documentStore';
import { useToolStore, ToolType } from '../stores/toolStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SignatureModal } from './SignatureModal';
import { useSave } from '../hooks/useSave';

export const App: React.FC = () => {
  useKeyboardShortcuts();
  const { documentInfo, openDocument, openDocumentByPath, isLoading, error } = useDocumentStore();
  const { saveDocument } = useSave();
  const { activeTool, setActiveTool } = useToolStore();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const [propertiesVisible, setPropertiesVisible] = React.useState(true);
  const [signatureModalOpen, setSignatureModalOpen] = React.useState(false);
  const [pendingSignatureDataUrl, setPendingSignatureDataUrl] = React.useState<string | null>(null);

  const handleMenuAction = useCallback(
    (action: string) => {
      const toolMap: Record<string, ToolType> = {
        'tool-select': 'select',
        'tool-edit-text': 'editText',
        'tool-insert-image': 'addImage',
        'tool-signature': 'signature',
        'tool-redact': 'redact',
        'tool-line': 'line',
        'tool-arrow': 'arrow',
        'tool-rect': 'rect',
        'tool-ellipse': 'ellipse',
        'tool-freehand': 'freehand',
        'tool-textbox': 'textBox',
      };

      if (toolMap[action]) {
        setActiveTool(toolMap[action]);
        return;
      }

      switch (action) {
        case 'file-open':
          openDocument();
          break;
        case 'file-save':
          saveDocument(false);
          break;
        case 'file-save-as':
          saveDocument(true);
          break;
        case 'zoom-in':
          useDocumentStore.getState().zoomIn();
          break;
        case 'zoom-out':
          useDocumentStore.getState().zoomOut();
          break;
        case 'toggle-sidebar':
          setSidebarVisible((v) => !v);
          break;
        case 'undo':
        case 'redo':
        case 'copy':
        case 'paste':
        case 'delete':
          // These will be handled by the annotation store in Phase 2
          break;
      }
    },
    [openDocument, setActiveTool, saveDocument]
  );

  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction(handleMenuAction);
    return cleanup;
  }, [handleMenuAction]);

  // Handle drag and drop
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.pdf') && (file as any).path) {
          openDocumentByPath((file as any).path);
        }
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [openDocumentByPath]);

  // Update window title when document changes
  useEffect(() => {
    if (documentInfo?.filePath) {
      const fileName = documentInfo.filePath.split(/[/\\]/).pop() || 'Untitled';
      document.title = `${fileName} - PDF View & Edit`;
    } else {
      document.title = 'PDF View & Edit';
    }
  }, [documentInfo]);

  // Open signature modal when signature tool is selected
  useEffect(() => {
    if (activeTool === 'signature') {
      setSignatureModalOpen(true);
    }
  }, [activeTool]);

  const handleSignatureApply = useCallback((dataUrl: string) => {
    setPendingSignatureDataUrl(dataUrl);
    setSignatureModalOpen(false);
    // The AnnotationCanvas will pick up the pending signature
    // and place it when the user clicks on the page
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {sidebarVisible && <Sidebar />}
        <div
          ref={viewportRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#525252',
            position: 'relative',
          }}
        >
          {documentInfo ? (
            <PageList containerRef={viewportRef} pendingSignatureDataUrl={pendingSignatureDataUrl} onSignaturePlaced={() => setPendingSignatureDataUrl(null)} />
          ) : (
            <WelcomeScreen onOpen={openDocument} />
          )}
        </div>
        {propertiesVisible && documentInfo && <PropertiesPanel />}
      </div>
      <StatusBar />
      <SignatureModal
        isOpen={signatureModalOpen}
        onClose={() => { setSignatureModalOpen(false); setActiveTool('select'); }}
        onApply={handleSignatureApply}
      />
      {isLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ color: 'white', fontSize: 18, background: 'var(--bg-secondary)', padding: '20px 40px', borderRadius: 8 }}>
            Loading document...
          </div>
        </div>
      )}
      {error && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, background: '#d32f2f',
          color: 'white', padding: '12px 20px', borderRadius: 6, zIndex: 9999,
          maxWidth: 400, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

const WelcomeScreen: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#999',
      gap: 16,
    }}
  >
    <div style={{ fontSize: 48, opacity: 0.3 }}>PDF</div>
    <div style={{ fontSize: 16 }}>Open a PDF file to get started</div>
    <button
      onClick={onOpen}
      style={{
        padding: '8px 24px',
        background: 'var(--accent-color)',
        color: 'white',
        borderRadius: 4,
        fontSize: 14,
      }}
    >
      Open File
    </button>
    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
      or drag and drop a PDF file here
    </div>
  </div>
);
