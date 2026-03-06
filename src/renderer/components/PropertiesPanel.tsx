import React from 'react';
import { useToolStore } from '../stores/toolStore';

export const PropertiesPanel: React.FC = () => {
  const {
    strokeColor, fillColor, strokeWidth, opacity,
    setStrokeColor, setFillColor, setStrokeWidth, setOpacity,
    fontSize, setFontSize, fontFamily, setFontFamily,
  } = useToolStore();

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Properties</div>

      <Section title="Stroke">
        <Row label="Color">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            style={styles.colorInput}
          />
        </Row>
        <Row label="Width">
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{strokeWidth}px</span>
        </Row>
      </Section>

      <Section title="Fill">
        <Row label="Color">
          <input
            type="color"
            value={fillColor === 'transparent' ? '#ffffff' : fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={styles.colorInput}
          />
          <button
            onClick={() => setFillColor('transparent')}
            style={{
              ...styles.smallBtn,
              background: fillColor === 'transparent' ? 'var(--accent-color)' : undefined,
            }}
          >
            None
          </button>
        </Row>
      </Section>

      <Section title="Opacity">
        <Row label="">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.value}>{Math.round(opacity * 100)}%</span>
        </Row>
      </Section>

      <Section title="Text">
        <Row label="Font">
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={styles.select}
          >
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
          </select>
        </Row>
        <Row label="Size">
          <input
            type="number"
            min={6}
            max={144}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
            style={styles.numberInput}
          />
        </Row>
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={styles.section}>
    <div style={styles.sectionTitle}>{title}</div>
    {children}
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.row}>
    {label && <span style={styles.label}>{label}</span>}
    <div style={styles.rowContent}>{children}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 'var(--properties-width)',
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-color)',
    overflow: 'auto',
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
  section: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    minWidth: 40,
  },
  rowContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
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
  slider: {
    flex: 1,
    height: 4,
    cursor: 'pointer',
  },
  value: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    minWidth: 35,
    textAlign: 'right' as const,
  },
  select: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    padding: '2px 4px',
    fontSize: 11,
  },
  numberInput: {
    width: 50,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    padding: '2px 4px',
    fontSize: 11,
    textAlign: 'center' as const,
  },
  smallBtn: {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 3,
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    background: 'transparent',
  },
};
