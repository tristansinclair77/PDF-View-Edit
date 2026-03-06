import { useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { useAnnotationStore } from '../stores/annotationStore';

export function useImageInsertion(pageNum: number, canvas: FabricCanvas | null) {
  const { addAnnotation } = useAnnotationStore();

  const insertImage = useCallback(async () => {
    if (!canvas) return;

    // Use a hidden file input since we're in the renderer process
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp,image/bmp';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;

        try {
          const img = await FabricImage.fromURL(dataUrl);

          // Scale down if image is larger than the canvas
          const maxWidth = canvas.width! * 0.8;
          const maxHeight = canvas.height! * 0.8;
          const imgWidth = img.width || 100;
          const imgHeight = img.height || 100;

          let scale = 1;
          if (imgWidth > maxWidth || imgHeight > maxHeight) {
            scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          }

          img.set({
            left: (canvas.width! - imgWidth * scale) / 2,
            top: (canvas.height! - imgHeight * scale) / 2,
            scaleX: scale,
            scaleY: scale,
            cornerSize: 10,
            borderColor: '#0078d4',
            cornerColor: '#0078d4',
          });

          const id = `img_${Date.now()}`;
          (img as any).__id = id;
          (img as any).__isInsertedImage = true;

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();

          addAnnotation(pageNum, JSON.stringify(img.toJSON()), id);
        } catch (err) {
          console.error('Failed to insert image:', err);
        }
      };

      reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }, [canvas, pageNum, addAnnotation]);

  return { insertImage };
}
