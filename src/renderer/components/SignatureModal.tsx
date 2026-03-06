import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, FabricImage } from 'fabric';

type SignatureMode = 'draw' | 'type' | 'upload';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (imageDataUrl: string) => void;
}

const SCRIPT_FONTS = [
  'cursive',
  'Georgia',
  'Times New Roman',
  'Brush Script MT',
];

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onApply }) => {
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(SCRIPT_FONTS[0]);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(3);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);

  // Initialize drawing canvas
  useEffect(() => {
    if (!isOpen || mode !== 'draw' || !drawCanvasRef.current) return;
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const canvas = new FabricCanvas(drawCanvasRef.current, {
      width: 400,
      height: 150,
      backgroundColor: '#ffffff',
      isDrawingMode: true,
    });

    const brush = new PencilBrush(canvas);
    brush.color = penColor;
    brush.width = penWidth;
    canvas.freeDrawingBrush = brush;
    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [isOpen, mode]);

  // Update brush settings
  useEffect(() => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = penColor;
      fabricRef.current.freeDrawingBrush.width = penWidth;
    }
  }, [penColor, penWidth]);

  const clearDraw = useCallback(() => {
    fabricRef.current?.clear();
    if (fabricRef.current) {
      fabricRef.current.backgroundColor = '#ffffff';
      fabricRef.current.renderAll();
    }
  }, []);

  const handleApply = useCallback(() => {
    let dataUrl: string | null = null;

    switch (mode) {
      case 'draw': {
        if (!fabricRef.current) return;
        // Export with transparent background
        fabricRef.current.backgroundColor = '';
        dataUrl = fabricRef.current.toDataURL({
          format: 'png',
          multiplier: 2, // 2x resolution for quality
        });
        fabricRef.current.backgroundColor = '#ffffff';
        break;
      }
      case 'type': {
        if (!typedName.trim()) return;
        // Render text to canvas
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d')!;
        const fontSize = 48;
        ctx.font = `${fontSize}px ${selectedFont}`;
        const metrics = ctx.measureText(typedName);
        tempCanvas.width = metrics.width + 20;
        tempCanvas.height = fontSize * 1.5;
        ctx.font = `${fontSize}px ${selectedFont}`;
        ctx.fillStyle = penColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, 10, tempCanvas.height / 2);
        dataUrl = tempCanvas.toDataURL('image/png');
        break;
      }
      case 'upload': {
        dataUrl = uploadedImage;
        break;
      }
    }

    if (dataUrl) {
      onApply(dataUrl);
    }
  }, [mode, typedName, selectedFont, penColor, uploadedImage, onApply]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }, []);

  // Save signature for reuse
  const handleSave = useCallback(async () => {
    let dataUrl: string | null = null;
    if (mode === 'draw' && fabricRef.current) {
      fabricRef.current.backgroundColor = '';
      dataUrl = fabricRef.current.toDataURL({ format: 'png', multiplier: 2 });
      fabricRef.current.backgroundColor = '#ffffff';
    } else if (mode === 'type' && typedName) {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d')!;
      ctx.font = `48px ${selectedFont}`;
      const metrics = ctx.measureText(typedName);
      tempCanvas.width = metrics.width + 20;
      tempCanvas.height = 72;
      ctx.font = `48px ${selectedFont}`;
      ctx.fillStyle = penColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 10, 36);
      dataUrl = tempCanvas.toDataURL('image/png');
    } else if (mode === 'upload') {
      dataUrl = uploadedImage;
    }

    if (dataUrl) {
      await window.electronAPI.signatureSave({
        name: typedName || `Signature ${Date.now()}`,
        imageData: dataUrl,
      });
    }
  }, [mode, typedName, selectedFont, penColor, uploadedImage]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Add Signature</span>
          <button style={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        {/* Tab buttons */}
        <div style={styles.tabs}>
          {(['draw', 'type', 'upload'] as SignatureMode[]).map((m) => (
            <button
              key={m}
              style={{
                ...styles.tab,
                ...(mode === m ? styles.tabActive : {}),
              }}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.body}>
          {mode === 'draw' && (
            <div>
              <div style={styles.drawControls}>
                <label style={styles.label}>Color</label>
                <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} />
                <label style={styles.label}>Width</label>
                <input
                  type="range" min={1} max={10} value={penWidth}
                  onChange={(e) => setPenWidth(parseInt(e.target.value))}
                />
                <button style={styles.btn} onClick={clearDraw}>Clear</button>
              </div>
              <canvas ref={drawCanvasRef} style={styles.drawCanvas} />
            </div>
          )}

          {mode === 'type' && (
            <div>
              <input
                type="text"
                placeholder="Type your name..."
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                style={styles.textInput}
                autoFocus
              />
              <div style={styles.fontList}>
                {SCRIPT_FONTS.map((font) => (
                  <button
                    key={font}
                    style={{
                      ...styles.fontOption,
                      fontFamily: font,
                      ...(selectedFont === font ? styles.fontOptionActive : {}),
                    }}
                    onClick={() => setSelectedFont(font)}
                  >
                    {typedName || 'Preview'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div style={styles.uploadArea}>
              {uploadedImage ? (
                <img src={uploadedImage} alt="Signature" style={styles.uploadPreview} />
              ) : (
                <button style={styles.uploadBtn} onClick={handleFileUpload}>
                  Choose Image File
                </button>
              )}
              {uploadedImage && (
                <button style={styles.btn} onClick={handleFileUpload}>
                  Choose Different File
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={styles.footer}>
          <button style={styles.btn} onClick={handleSave}>Save for Reuse</button>
          <div style={{ flex: 1 }} />
          <button style={styles.btn} onClick={onClose}>Cancel</button>
          <button style={styles.applyBtn} onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    width: 460,
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
  },
  title: { fontWeight: 600, fontSize: 14 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 16,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
  },
  tab: {
    flex: 1, padding: '8px', textAlign: 'center' as const,
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 13,
  },
  tabActive: {
    color: 'var(--accent-color)',
    borderBottom: '2px solid var(--accent-color)',
  },
  body: {
    padding: 16,
    flex: 1,
    overflow: 'auto',
  },
  drawControls: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  drawCanvas: {
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    display: 'block',
    cursor: 'crosshair',
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 16,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    marginBottom: 12,
  },
  fontList: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  fontOption: {
    padding: '12px 16px',
    fontSize: 24,
    background: 'var(--bg-tertiary)',
    border: '2px solid transparent',
    borderRadius: 4,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  fontOptionActive: {
    borderColor: 'var(--accent-color)',
  },
  uploadArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  uploadBtn: {
    padding: '16px 32px',
    background: 'var(--bg-tertiary)',
    border: '2px dashed var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 14,
  },
  uploadPreview: {
    maxWidth: '100%', maxHeight: 150,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border-color)',
  },
  btn: {
    padding: '6px 14px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 12,
  },
  applyBtn: {
    padding: '6px 18px',
    background: 'var(--accent-color)',
    border: 'none',
    borderRadius: 4,
    color: 'white',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  label: {
    fontSize: 12, color: 'var(--text-secondary)',
  },
};
