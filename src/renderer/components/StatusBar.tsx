import React from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { useToolStore } from '../stores/toolStore';

export const StatusBar: React.FC = () => {
  const { documentInfo, currentPage, zoom, isModified } = useDocumentStore();
  const { activeTool } = useToolStore();

  return (
    <div style={styles.statusBar}>
      <div style={styles.left}>
        {documentInfo ? (
          <>
            <span>
              Page {currentPage + 1} of {documentInfo.pageCount}
            </span>
            <Dot />
            <span>{Math.round(zoom * 100)}%</span>
            {isModified && (
              <>
                <Dot />
                <span style={{ color: 'var(--warning-color)' }}>Modified</span>
              </>
            )}
          </>
        ) : (
          <span>No document open</span>
        )}
      </div>
      <div style={styles.right}>
        <span style={{ textTransform: 'capitalize' }}>{activeTool}</span>
      </div>
    </div>
  );
};

const Dot: React.FC = () => (
  <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
);

const styles: Record<string, React.CSSProperties> = {
  statusBar: {
    height: 'var(--statusbar-height)',
    background: 'var(--accent-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    fontSize: 12,
    color: 'white',
    userSelect: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
  },
};
