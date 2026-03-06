import { useCallback, useRef } from 'react';
import { Canvas as FabricCanvas, IText, Rect } from 'fabric';
import { mapPdfFont } from '../utils/fontMapper';
import { useDocumentStore } from '../stores/documentStore';
import { useAnnotationStore } from '../stores/annotationStore';
import type { TextBlock } from '../../shared/types';

interface TextEditRecord {
  pageNum: number;
  originalBlock: TextBlock;
  fabricObjectId: string;
  coverRectId: string;
}

const editRecords: Map<string, TextEditRecord> = new Map();

export function useTextEditing(pageNum: number, canvas: FabricCanvas | null) {
  const zoom = useDocumentStore((s) => s.zoom);
  const { addAnnotation } = useAnnotationStore();
  const textBlocksRef = useRef<TextBlock[] | null>(null);
  const editedBlocksRef = useRef<Set<string>>(new Set());

  const loadTextBlocks = useCallback(async () => {
    try {
      const blocks = await window.electronAPI.pdfExtractText({ pageNum });
      textBlocksRef.current = blocks;
      return blocks;
    } catch (err) {
      console.error('Failed to load text blocks:', err);
      textBlocksRef.current = [];
      return [];
    }
  }, [pageNum]);

  // Create a cover rect + IText overlay for a single text block (no enter-editing)
  const createOverlay = useCallback(
    (hit: TextBlock): boolean => {
      if (!canvas) return false;

      const blockKey = `${hit.x}_${hit.y}_${hit.width}_${hit.height}`;
      if (editedBlocksRef.current.has(blockKey)) return false;
      editedBlocksRef.current.add(blockKey);

      const fontMatch = mapPdfFont(hit.fontName);
      const scaledX = hit.x * zoom;
      const scaledY = hit.y * zoom;
      const scaledW = hit.width * zoom;
      const scaledH = hit.height * zoom;

      const fabricBaselineOffset = hit.fontSize * 1.13 * (1 - 0.222);
      const textTop = (hit.baseline - fabricBaselineOffset) * zoom;

      // Cover rect uses MuPDF block bounds (matches the original rendered text)
      // with 1px padding for anti-aliasing
      const coverRect = new Rect({
        left: scaledX - 1,
        top: scaledY - 1,
        width: scaledW + 2,
        height: scaledH + 2,
        originX: 'left',
        originY: 'top',
        fill: 'white',
        selectable: false,
        evented: false,
        excludeFromExport: false,
      });
      const coverId = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      (coverRect as any).__id = coverId;
      (coverRect as any).__isCoverRect = true;
      canvas.add(coverRect);
      canvas.sendObjectToBack(coverRect);

      const textObj = new IText(hit.text, {
        left: scaledX,
        top: textTop,
        originX: 'left',
        originY: 'top',
        fontSize: hit.fontSize * zoom,
        fontFamily: fontMatch.family,
        fontWeight: fontMatch.weight as string,
        fontStyle: fontMatch.style as string,
        fill: hit.color || '#000000',
        lineHeight: 1.0,
        editable: true,
        borderColor: '#0078d4',
        cornerColor: '#0078d4',
        cornerSize: 8,
        padding: 0,
      });

      const id = `text_edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      (textObj as any).__id = id;
      (textObj as any).__isTextEdit = true;
      (textObj as any).__blockKey = blockKey;
      (textObj as any).__coverRect = coverRect;

      // Cover rect stays at the original position to always hide the PDF-rendered text.
      // It does NOT move with the IText — MuPDF always renders at the original spot.

      editRecords.set(id, {
        pageNum,
        originalBlock: hit,
        fabricObjectId: id,
        coverRectId: coverId,
      });

      canvas.add(textObj);
      addAnnotation(pageNum, JSON.stringify(textObj.toJSON()), id);
      return true;
    },
    [canvas, zoom, pageNum, addAnnotation]
  );

  const handleTextClick = useCallback(
    async (screenX: number, screenY: number) => {
      if (!canvas) return;

      // Exit editing on ALL IText objects and clear cursor rendering
      canvas.getObjects().forEach((obj) => {
        if (obj instanceof IText) {
          if (obj.isEditing) obj.exitEditing();
          obj.clearContextTop();
        }
      });
      canvas.discardActiveObject();

      const pdfX = screenX / zoom;
      const pdfY = screenY / zoom;

      let blocks = textBlocksRef.current;
      if (blocks === null) {
        blocks = await loadTextBlocks();
      }

      if (!blocks || blocks.length === 0) return;

      const TOLERANCE = 2;
      let hit = blocks.find((block) => {
        return (
          pdfX >= block.x - TOLERANCE &&
          pdfX <= block.x + block.width + TOLERANCE &&
          pdfY >= block.y - TOLERANCE &&
          pdfY <= block.y + block.height + TOLERANCE
        );
      });

      if (!hit) {
        let minDist = 20;
        for (const block of blocks) {
          const cx = block.x + block.width / 2;
          const cy = block.y + block.height / 2;
          const dist = Math.hypot(pdfX - cx, pdfY - cy);
          if (dist < minDist) {
            minDist = dist;
            hit = block;
          }
        }
      }

      if (!hit) return;

      // Check if already editing this block
      const blockKey = `${hit.x}_${hit.y}_${hit.width}_${hit.height}`;
      if (editedBlocksRef.current.has(blockKey)) {
        const existing = canvas.getObjects().find(
          (obj) => (obj as any).__blockKey === blockKey
        );
        if (existing) {
          canvas.setActiveObject(existing);
          if (existing instanceof IText) existing.enterEditing();
          canvas.renderAll();
        }
        return;
      }

      createOverlay(hit);
      // Enter editing on the just-created object
      const objs = canvas.getObjects();
      const last = objs[objs.length - 1];
      if (last instanceof IText) {
        canvas.setActiveObject(last);
        last.enterEditing();
      }
      canvas.renderAll();
    },
    [canvas, zoom, loadTextBlocks, createOverlay]
  );

  const editAllBlocks = useCallback(async () => {
    if (!canvas) return;

    let blocks = textBlocksRef.current;
    if (blocks === null) {
      blocks = await loadTextBlocks();
    }
    if (!blocks || blocks.length === 0) return;

    for (const block of blocks) {
      createOverlay(block);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
  }, [canvas, loadTextBlocks, createOverlay]);

  return { handleTextClick, loadTextBlocks, editAllBlocks };
}

export function getTextEditRecords(): Map<string, TextEditRecord> {
  return editRecords;
}
