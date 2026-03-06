import React, { useEffect, useState, useCallback } from 'react';
import { useDocumentStore } from '../stores/documentStore';

const THUMBNAIL_DPI = 36; // Low DPI for small thumbnails

export const Sidebar: React.FC = () => {
  const { documentInfo, currentPage, setCurrentPage } = useDocumentStore();

  if (!documentInfo) return null;

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>Pages</div>
      <div style={styles.pageList}>
        {Array.from({ length: documentInfo.pageCount }, (_, i) => (
          <ThumbnailItem
            key={i}
            pageNum={i}
            isActive={currentPage === i}
            onClick={() => setCurrentPage(i)}
          />
        ))}
      </div>
    </div>
  );
};

const ThumbnailItem: React.FC<{
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ pageNum, isActive, onClick }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnail = async () => {
      try {
        const data = await window.electronAPI.pdfRenderPage({ pageNum, dpi: THUMBNAIL_DPI });
        if (cancelled) return;

        const view = new DataView(data);
        const width = view.getUint32(0, true);
        const height = view.getUint32(4, true);
        const pixels = new Uint8ClampedArray(data, 8);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = new ImageData(pixels, width, height);
        ctx.putImageData(imageData, 0, 0);

        setThumbnailUrl(canvas.toDataURL());
      } catch {
        // Thumbnail load failed — leave blank
      }
    };

    loadThumbnail();
    return () => { cancelled = true; };
  }, [pageNum]);

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.thumbnail,
        borderColor: isActive ? 'var(--accent-color)' : 'transparent',
      }}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={`Page ${pageNum + 1}`} style={styles.thumbnailImg} />
      ) : (
        <div style={styles.thumbnailPlaceholder} />
      )}
      <span style={styles.pageLabel}>{pageNum + 1}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--border-color)',
  },
  pageList: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  thumbnail: {
    cursor: 'pointer',
    border: '2px solid transparent',
    borderRadius: 4,
    padding: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'border-color 0.15s',
    width: '100%',
  },
  thumbnailImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  thumbnailPlaceholder: {
    width: '100%',
    aspectRatio: '8.5 / 11',
    background: 'var(--bg-tertiary)',
    borderRadius: 2,
  },
  pageLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
};
