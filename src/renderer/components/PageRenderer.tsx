import React, { useRef, useEffect, useState } from 'react';
import { usePageRenderer } from '../hooks/usePageRenderer';
import { useDocumentStore } from '../stores/documentStore';
import { AnnotationCanvas } from './AnnotationCanvas';

interface PageRendererProps {
  pageNum: number;
  isVisible: boolean;
  pendingSignatureDataUrl?: string | null;
  onSignaturePlaced?: () => void;
}

export const PageRenderer: React.FC<PageRendererProps> = ({ pageNum, isVisible, pendingSignatureDataUrl, onSignaturePlaced }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useDocumentStore((s) => s.zoom);
  const loadPageInfo = useDocumentStore((s) => s.loadPageInfo);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    loadPageInfo(pageNum).then((info) => {
      setPageSize({ width: info.width, height: info.height });
    });
  }, [pageNum, loadPageInfo]);

  // Only render when visible — hooks must be called unconditionally
  const renderResult = usePageRenderer(canvasRef, pageNum, isVisible);
  const { isRendering } = renderResult;

  const displayWidth = pageSize ? pageSize.width * zoom : 0;
  const displayHeight = pageSize ? pageSize.height * zoom : 0;

  return (
    <div
      style={{
        position: 'relative',
        width: displayWidth || 'auto',
        height: displayHeight || 300,
        margin: '10px auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        background: 'white',
      }}
      data-page={pageNum}
    >
      {/* Layer 1: MuPDF rendered PDF page (bottom) */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Layer 2: Fabric.js annotation overlay (top) */}
      {isVisible && displayWidth > 0 && displayHeight > 0 && (
        <AnnotationCanvas
          pageNum={pageNum}
          width={displayWidth}
          height={displayHeight}
          pendingSignatureDataUrl={pendingSignatureDataUrl}
          onSignaturePlaced={onSignaturePlaced}
        />
      )}

      {isRendering && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            color: '#666',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          Rendering...
        </div>
      )}

      {/* Page number label */}
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 11,
          color: '#999',
          pointerEvents: 'none',
        }}
      >
        {pageNum + 1}
      </div>
    </div>
  );
};
