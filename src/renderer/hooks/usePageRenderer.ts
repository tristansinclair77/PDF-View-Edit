import { useEffect, useRef, useState, useCallback } from 'react';
import { useDocumentStore } from '../stores/documentStore';

// LRU cache for rendered page image data
const PAGE_CACHE = new Map<string, ImageBitmap>();
const CACHE_MAX = 10;

function cacheKey(pageNum: number, dpi: number): string {
  return `${pageNum}@${dpi}`;
}

function addToCache(key: string, bitmap: ImageBitmap): void {
  if (PAGE_CACHE.size >= CACHE_MAX) {
    const oldest = PAGE_CACHE.keys().next().value;
    if (oldest !== undefined) {
      const old = PAGE_CACHE.get(oldest);
      old?.close();
      PAGE_CACHE.delete(oldest);
    }
  }
  PAGE_CACHE.set(key, bitmap);
}

export function usePageRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  pageNum: number,
  isVisible: boolean = true
): { isRendering: boolean; width: number; height: number } {
  const zoom = useDocumentStore((s) => s.zoom);
  const [isRendering, setIsRendering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderIdRef = useRef(0);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const renderId = ++renderIdRef.current;
    const dpi = Math.round(72 * zoom * window.devicePixelRatio);
    const key = cacheKey(pageNum, dpi);

    // Check cache
    const cached = PAGE_CACHE.get(key);
    if (cached) {
      canvas.width = cached.width;
      canvas.height = cached.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(cached, 0, 0);
      setDimensions({
        width: cached.width / window.devicePixelRatio,
        height: cached.height / window.devicePixelRatio,
      });
      return;
    }

    setIsRendering(true);
    try {
      const data = await window.electronAPI.pdfRenderPage({ pageNum, dpi });
      if (renderId !== renderIdRef.current) return; // stale

      const view = new DataView(data);
      const width = view.getUint32(0, true);
      const height = view.getUint32(4, true);
      const pixels = new Uint8ClampedArray(data, 8);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = new ImageData(pixels, width, height);
      ctx.putImageData(imageData, 0, 0);

      // Cache as ImageBitmap
      const bitmap = await createImageBitmap(imageData);
      if (renderId === renderIdRef.current) {
        addToCache(key, bitmap);
      } else {
        bitmap.close();
      }

      setDimensions({
        width: width / window.devicePixelRatio,
        height: height / window.devicePixelRatio,
      });
    } catch (err) {
      console.error(`Failed to render page ${pageNum}:`, err);
    } finally {
      if (renderId === renderIdRef.current) {
        setIsRendering(false);
      }
    }
  }, [canvasRef, pageNum, zoom, isVisible]);

  useEffect(() => {
    render();
  }, [render]);

  return { isRendering, width: dimensions.width, height: dimensions.height };
}

export function clearPageCache(): void {
  PAGE_CACHE.forEach((bitmap) => bitmap.close());
  PAGE_CACHE.clear();
}
