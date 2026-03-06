import React from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { useToolStore, ToolType } from '../stores/toolStore';
import { useAnnotationStore } from '../stores/annotationStore';
import { useSave } from '../hooks/useSave';

const TOOL_GROUPS: { tools: { id: ToolType; label: string; shortcut?: string }[] }[] = [
  {
    tools: [
      { id: 'select', label: 'Select', shortcut: 'V' },
      { id: 'editText', label: 'Edit Text', shortcut: 'T' },
      { id: 'addImage', label: 'Image' },
      { id: 'signature', label: 'Sign' },
      { id: 'redact', label: 'Redact' },
    ],
  },
  {
    tools: [
      { id: 'line', label: 'Line', shortcut: 'L' },
      { id: 'arrow', label: 'Arrow' },
      { id: 'rect', label: 'Rect', shortcut: 'R' },
      { id: 'ellipse', label: 'Ellipse', shortcut: 'E' },
      { id: 'freehand', label: 'Draw', shortcut: 'P' },
      { id: 'textBox', label: 'Text' },
      { id: 'highlight', label: 'Highlight' },
    ],
  },
];

export const Toolbar: React.FC = () => {
  const { documentInfo, openDocument, zoom, zoomIn, zoomOut, setZoom } = useDocumentStore();
  const { activeTool, setActiveTool, strokeColor, setStrokeColor, fillColor, setFillColor, triggerEditAllText } = useToolStore();
  const { saveDocument } = useSave();
  const { undo, redo } = useAnnotationStore();

  return (
    <div style={styles.toolbar}>
      {/* File actions row */}
      <div style={styles.row}>
        <ToolbarButton label="Open" onClick={openDocument} />
        <ToolbarButton label="Save" onClick={() => saveDocument(false)} disabled={!documentInfo} />
        <ToolbarButton label="Save As" onClick={() => saveDocument(true)} disabled={!documentInfo} />
        <Divider />
        <ToolbarButton label="Undo" onClick={undo} disabled={!documentInfo} />
        <ToolbarButton label="Redo" onClick={redo} disabled={!documentInfo} />
        <Divider />
        <ToolbarButton label="-" onClick={zoomOut} disabled={!documentInfo} />
        <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <ToolbarButton label="+" onClick={zoomIn} disabled={!documentInfo} />
      </div>

      {/* Tools row */}
      <div style={styles.row}>
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <Divider />}
            {group.tools.map((tool) => (
              <ToolbarButton
                key={tool.id}
                label={tool.label}
                active={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
                disabled={!documentInfo}
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              />
            ))}
          </React.Fragment>
        ))}
        <Divider />
        <ToolbarButton
          label="Edit All Text"
          onClick={triggerEditAllText}
          disabled={!documentInfo}
          title="Convert all text on visible pages to editable overlays"
        />
        <Divider />
        <div style={styles.colorGroup}>
          <label style={styles.colorLabel}>Stroke</label>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            style={styles.colorInput}
          />
          <label style={styles.colorLabel}>Fill</label>
          <input
            type="color"
            value={fillColor === 'transparent' ? '#ffffff' : fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={styles.colorInput}
          />
          <button
            onClick={() => setFillColor('transparent')}
            style={{
              ...styles.btn,
              fontSize: 10,
              padding: '2px 6px',
              opacity: fillColor === 'transparent' ? 1 : 0.5,
            }}
            title="No fill"
          >
            No Fill
          </button>
        </div>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}> = ({ label, onClick, active, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    style={{
      ...styles.btn,
      background: active ? 'var(--accent-color)' : undefined,
      color: active ? 'white' : undefined,
    }}
  >
    {label}
  </button>
);

const Divider: React.FC = () => (
  <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 4px' }} />
);

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    padding: '4px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    userSelect: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexWrap: 'wrap',
  },
  btn: {
    padding: '4px 10px',
    borderRadius: 3,
    fontSize: 12,
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  zoomLabel: {
    fontSize: 12,
    minWidth: 45,
    textAlign: 'center' as const,
    color: 'var(--text-primary)',
  },
  colorGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  colorLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  colorInput: {
    width: 24,
    height: 24,
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'none',
    padding: 0,
  },
};
