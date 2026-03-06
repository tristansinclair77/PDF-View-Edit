import React, { useRef, useEffect, useCallback } from 'react';
import { Canvas as FabricCanvas, Line, Rect, Ellipse, IText, FabricObject, FabricImage, TPointerEventInfo, PencilBrush } from 'fabric';
import { useToolStore, ToolType } from '../stores/toolStore';
import { useAnnotationStore } from '../stores/annotationStore';
import { useDocumentStore } from '../stores/documentStore';
import { useTextEditing } from '../hooks/useTextEditing';
import { useImageInsertion } from '../hooks/useImageInsertion';

interface AnnotationCanvasProps {
  pageNum: number;
  width: number;
  height: number;
  pendingSignatureDataUrl?: string | null;
  onSignaturePlaced?: () => void;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ pageNum, width, height, pendingSignatureDataUrl, onSignaturePlaced }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<FabricObject | null>(null);

  const { activeTool, strokeColor, fillColor, strokeWidth, opacity, fontSize, fontFamily, editAllTextTrigger } = useToolStore();
  const { addAnnotation, removeAnnotation, modifyAnnotation } = useAnnotationStore();
  const zoom = useDocumentStore((s) => s.zoom);
  const { handleTextClick, editAllBlocks } = useTextEditing(pageNum, fabricRef.current);
  const { insertImage } = useImageInsertion(pageNum, fabricRef.current);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      selection: true,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
    });

    fabricRef.current = canvas;

    // Track object modifications for undo
    canvas.on('object:modified', (e) => {
      if (e.target) {
        const id = (e.target as any).__id || generateId();
        (e.target as any).__id = id;
        modifyAnnotation(pageNum, id, JSON.stringify(e.target.toJSON()), '');
      }
    });

    // Clean up empty placeholder text boxes when clicking away
    canvas.on('mouse:down', (opt) => {
      const toRemove: FabricObject[] = [];
      canvas.getObjects().forEach((obj) => {
        if ((obj as any).__isPlaceholder && obj !== canvas.getActiveObject()) {
          toRemove.push(obj);
        }
      });
      for (const obj of toRemove) {
        const objId = (obj as any).__id || '';
        useAnnotationStore.getState().removeAnnotation(pageNum, objId, JSON.stringify(obj.toJSON()));
        canvas.remove(obj);
      }
      if (toRemove.length > 0) {
        canvas.renderAll();
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Update canvas size and rescale objects when dimensions change (zoom)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const oldW = canvas.getWidth();
    const oldH = canvas.getHeight();

    if (oldW > 0 && oldH > 0 && (oldW !== width || oldH !== height)) {
      const sx = width / oldW;
      const sy = height / oldH;
      canvas.getObjects().forEach((obj) => {
        obj.set({
          left: (obj.left || 0) * sx,
          top: (obj.top || 0) * sy,
          scaleX: (obj.scaleX || 1) * sx,
          scaleY: (obj.scaleY || 1) * sy,
        });
        obj.setCoords();
      });
    }

    canvas.setDimensions({ width, height });
    canvas.renderAll();
  }, [width, height]);

  // Configure tool behavior
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset drawing mode
    canvas.isDrawingMode = false;
    canvas.selection = activeTool === 'select' || activeTool === 'editText';
    canvas.defaultCursor = 'default';

    if (activeTool === 'freehand') {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    } else if (activeTool === 'select') {
      canvas.defaultCursor = 'default';
    } else if (['line', 'arrow', 'rect', 'ellipse', 'highlight', 'textBox', 'redact'].includes(activeTool)) {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
    }

    canvas.renderAll();
  }, [activeTool, strokeColor, strokeWidth]);

  // Handle mouse events for shape drawing
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const cancelDrawing = () => {
      if (isDrawingRef.current && activeShapeRef.current) {
        canvas.remove(activeShapeRef.current);
        canvas.renderAll();
      }
      isDrawingRef.current = false;
      activeShapeRef.current = null;
      drawStartRef.current = null;
    };

    const getPointerFromEvent = (e: TPointerEvent): { x: number; y: number } => {
      const mouseEvt = e as MouseEvent;
      const el = canvas.getSelectionElement();
      const rect = el.getBoundingClientRect();
      const x = mouseEvt.clientX - rect.left;
      const y = mouseEvt.clientY - rect.top;
      // DEBUG: log coordinate systems to find the offset bug
      console.log('POINTER DEBUG', {
        clientX: mouseEvt.clientX, clientY: mouseEvt.clientY,
        rectLeft: rect.left, rectTop: rect.top, rectW: rect.width, rectH: rect.height,
        elW: el.offsetWidth, elH: el.offsetHeight,
        canvasW: canvas.width, canvasH: canvas.height,
        cssW: el.style.width, cssH: el.style.height,
        htmlW: (el as HTMLCanvasElement).width, htmlH: (el as HTMLCanvasElement).height,
        dpr: window.devicePixelRatio,
        manual: { x, y },
        scenePoint: canvas.getScenePoint(e),
        viewportPoint: canvas.getViewportPoint(e),
      });
      return { x, y };
    };

    const handleMouseDown = (opt: TPointerEventInfo) => {
      if (activeTool === 'select' || activeTool === 'freehand') return;

      // Only draw with primary mouse button
      const nativeEvent = opt.e as MouseEvent;
      if (nativeEvent.button !== undefined && nativeEvent.button !== 0) return;

      // Cancel any in-progress drawing first
      if (isDrawingRef.current) {
        cancelDrawing();
      }

      const pointer = getPointerFromEvent(opt.e);

      // Text editing: click to extract and overlay
      if (activeTool === 'editText') {
        // Exit editing on ALL IText objects and clear cursor rendering
        canvas.getObjects().forEach((obj) => {
          if (obj instanceof IText) {
            if (obj.isEditing) obj.exitEditing();
            obj.clearContextTop();
          }
        });
        canvas.discardActiveObject();
        canvas.renderAll();
        // If clicking on an existing text edit object, let Fabric handle selection/drag
        const target = canvas.findTarget(opt.e);
        if (target && (target as any).__isTextEdit) {
          canvas.setActiveObject(target);
          return;
        }
        handleTextClick(pointer.x, pointer.y);
        return;
      }

      // Image insertion: open file dialog
      if (activeTool === 'addImage') {
        insertImage();
        return;
      }

      // Signature placement: place the pending signature image
      if (activeTool === 'signature' && pendingSignatureDataUrl) {
        FabricImage.fromURL(pendingSignatureDataUrl).then((img) => {
          const scale = Math.min(200 / (img.width || 200), 80 / (img.height || 80));
          img.set({
            left: pointer.x - (img.width || 200) * scale / 2,
            top: pointer.y - (img.height || 80) * scale / 2,
            scaleX: scale,
            scaleY: scale,
          });
          const id = `sig_${Date.now()}`;
          (img as any).__id = id;
          (img as any).__isSignature = true;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          addAnnotation(pageNum, JSON.stringify(img.toJSON()), id);
          onSignaturePlaced?.();
        });
        return;
      }
      isDrawingRef.current = true;
      drawStartRef.current = { x: pointer.x, y: pointer.y };

      let shape: FabricObject | null = null;
      const baseProps = {
        left: pointer.x,
        top: pointer.y,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor === 'transparent' ? '' : fillColor,
        opacity,
        selectable: true,
        evented: true,
      };

      switch (activeTool) {
        case 'line':
        case 'arrow':
          shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            ...baseProps,
            fill: '',
          });
          break;
        case 'rect':
          shape = new Rect({
            ...baseProps,
            width: 0,
            height: 0,
          });
          break;
        case 'ellipse':
          shape = new Ellipse({
            ...baseProps,
            rx: 0,
            ry: 0,
          });
          break;
        case 'highlight':
          shape = new Rect({
            ...baseProps,
            fill: '#ffff00',
            opacity: 0.4,
            stroke: '',
            strokeWidth: 0,
            width: 0,
            height: 0,
          });
          break;
        case 'redact':
          shape = new Rect({
            ...baseProps,
            fill: 'rgba(255, 0, 0, 0.2)',
            stroke: '#ff0000',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            width: 0,
            height: 0,
          });
          break;
        case 'textBox': {
          // Remove any previous unedited placeholder text boxes
          canvas.getObjects().forEach((obj) => {
            if ((obj as any).__isPlaceholder) {
              const objId = (obj as any).__id || '';
              removeAnnotation(pageNum, objId, JSON.stringify(obj.toJSON()));
              canvas.remove(obj);
            }
          });

          const text = new IText('', {
            left: pointer.x,
            top: pointer.y,
            originX: 'left',
            originY: 'top',
            fontSize,
            fontFamily,
            fill: strokeColor,
            editable: true,
          });
          const id = generateId();
          (text as any).__id = id;
          (text as any).__isPlaceholder = true;
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();

          // Remove placeholder flag once user types
          text.on('changed', () => {
            if (text.text && text.text.length > 0) {
              (text as any).__isPlaceholder = false;
            }
          });

          addAnnotation(pageNum, JSON.stringify(text.toJSON()), id);
          return;
        }
      }

      if (shape) {
        activeShapeRef.current = shape;
        canvas.add(shape);
        canvas.renderAll();
      }
    };

    const handleMouseMove = (opt: TPointerEventInfo) => {
      if (!isDrawingRef.current || !drawStartRef.current || !activeShapeRef.current) return;

      const pointer = getPointerFromEvent(opt.e);
      const startX = drawStartRef.current.x;
      const startY = drawStartRef.current.y;
      const shape = activeShapeRef.current;

      switch (activeTool) {
        case 'line':
        case 'arrow':
          (shape as Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
          break;
        case 'rect':
        case 'highlight':
        case 'redact':
          (shape as Rect).set({
            left: Math.min(startX, pointer.x),
            top: Math.min(startY, pointer.y),
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
          });
          break;
        case 'ellipse':
          (shape as Ellipse).set({
            left: Math.min(startX, pointer.x),
            top: Math.min(startY, pointer.y),
            rx: Math.abs(pointer.x - startX) / 2,
            ry: Math.abs(pointer.y - startY) / 2,
          });
          break;
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawingRef.current || !activeShapeRef.current) return;

      isDrawingRef.current = false;
      const shape = activeShapeRef.current;
      activeShapeRef.current = null;
      drawStartRef.current = null;

      // Remove tiny shapes (accidental clicks)
      const bounds = shape.getBoundingRect();
      if (bounds.width < 3 && bounds.height < 3) {
        canvas.remove(shape);
        return;
      }

      const id = generateId();
      (shape as any).__id = id;

      // Handle redaction specially
      if (activeTool === 'redact') {
        const rect = shape as Rect;
        useAnnotationStore.getState().addPendingRedaction({
          id,
          pageNum,
          rect: {
            x: (rect.left || 0) / zoom,
            y: (rect.top || 0) / zoom,
            width: (rect.width || 0) / zoom,
            height: (rect.height || 0) / zoom,
          },
          fillColor: '#000000',
        });
      }

      addAnnotation(pageNum, JSON.stringify(shape.toJSON()), id);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    };

    const handleMouseOut = () => {
      cancelDrawing();
    };

    const handleContextMenu = (e: Event) => {
      cancelDrawing();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('mouse:out', handleMouseOut);

    const upperCanvas = canvas.upperCanvasEl;
    if (upperCanvas) {
      upperCanvas.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:out', handleMouseOut);
      if (upperCanvas) {
        upperCanvas.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [activeTool, strokeColor, fillColor, strokeWidth, opacity, fontSize, fontFamily, pageNum, zoom, addAnnotation]);

  // Handle keyboard shortcuts on selected objects
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = canvas.getActiveObject();
      if (!active) return;

      // Don't handle if typing in text
      if (active instanceof IText && (active as IText).isEditing) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          const id = (active as any).__id || '';
          removeAnnotation(pageNum, id, JSON.stringify(active.toJSON()));
          canvas.remove(active);
          canvas.renderAll();
          e.preventDefault();
          break;
        }
        case 'ArrowUp':
          active.set('top', (active.top || 0) - (e.shiftKey ? 10 : 1));
          canvas.renderAll();
          e.preventDefault();
          break;
        case 'ArrowDown':
          active.set('top', (active.top || 0) + (e.shiftKey ? 10 : 1));
          canvas.renderAll();
          e.preventDefault();
          break;
        case 'ArrowLeft':
          active.set('left', (active.left || 0) - (e.shiftKey ? 10 : 1));
          canvas.renderAll();
          e.preventDefault();
          break;
        case 'ArrowRight':
          active.set('left', (active.left || 0) + (e.shiftKey ? 10 : 1));
          canvas.renderAll();
          e.preventDefault();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pageNum, removeAnnotation]);

  // Handle freehand path creation
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: any) => {
      if (e.path) {
        const id = generateId();
        (e.path as any).__id = id;
        addAnnotation(pageNum, JSON.stringify(e.path.toJSON()), id);
      }
    };

    canvas.on('path:created', handlePathCreated);
    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [pageNum, addAnnotation]);

  // Handle "Edit All Text" trigger from toolbar
  const editAllTriggerRef = useRef(0);
  useEffect(() => {
    if (editAllTextTrigger > 0 && editAllTextTrigger !== editAllTriggerRef.current) {
      editAllTriggerRef.current = editAllTextTrigger;
      editAllBlocks();
    }
  }, [editAllTextTrigger, editAllBlocks]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

let idCounter = 0;
function generateId(): string {
  return `ann_${Date.now()}_${idCounter++}`;
}
