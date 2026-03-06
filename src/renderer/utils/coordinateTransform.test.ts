import { describe, it, expect } from 'vitest';
import { CoordinateTransform } from './coordinateTransform';

describe('CoordinateTransform', () => {
  const pageWidth = 612; // US Letter width in points
  const pageHeight = 792; // US Letter height in points

  describe('at zoom 1.0', () => {
    const ct = new CoordinateTransform(pageWidth, pageHeight, 1.0, 1);

    it('pdfToScreenX passes through at zoom 1', () => {
      expect(ct.pdfToScreenX(100)).toBe(100);
    });

    it('pdfToScreenY flips Y axis', () => {
      // PDF Y=0 is bottom, screen Y=0 is top
      expect(ct.pdfToScreenY(0)).toBe(792); // bottom of PDF → bottom of screen
      expect(ct.pdfToScreenY(792)).toBe(0); // top of PDF → top of screen
    });

    it('screenToPdfX passes through at zoom 1', () => {
      expect(ct.screenToPdfX(100)).toBe(100);
    });

    it('screenToPdfY flips Y axis', () => {
      expect(ct.screenToPdfY(0)).toBe(792);
      expect(ct.screenToPdfY(792)).toBe(0);
    });

    it('round-trips X coordinates', () => {
      expect(ct.screenToPdfX(ct.pdfToScreenX(250))).toBe(250);
    });

    it('round-trips Y coordinates', () => {
      expect(ct.screenToPdfY(ct.pdfToScreenY(400))).toBeCloseTo(400);
    });

    it('getCanvasSize returns page dimensions', () => {
      const size = ct.getCanvasSize();
      expect(size.width).toBe(612);
      expect(size.height).toBe(792);
    });
  });

  describe('at zoom 2.0', () => {
    const ct = new CoordinateTransform(pageWidth, pageHeight, 2.0, 1);

    it('pdfToScreenX doubles coordinates', () => {
      expect(ct.pdfToScreenX(100)).toBe(200);
    });

    it('pdfToScreenY doubles and flips', () => {
      expect(ct.pdfToScreenY(0)).toBe(1584); // 792 * 2
      expect(ct.pdfToScreenY(792)).toBe(0);
    });

    it('screenToPdfX halves coordinates', () => {
      expect(ct.screenToPdfX(200)).toBe(100);
    });

    it('width/height scale with zoom', () => {
      expect(ct.pdfToScreenWidth(100)).toBe(200);
      expect(ct.pdfToScreenHeight(50)).toBe(100);
      expect(ct.screenToPdfWidth(200)).toBe(100);
      expect(ct.screenToPdfHeight(100)).toBe(50);
    });

    it('getCanvasSize doubles', () => {
      const size = ct.getCanvasSize();
      expect(size.width).toBe(1224);
      expect(size.height).toBe(1584);
    });
  });

  describe('at zoom 0.5', () => {
    const ct = new CoordinateTransform(pageWidth, pageHeight, 0.5, 1);

    it('pdfToScreenX halves coordinates', () => {
      expect(ct.pdfToScreenX(200)).toBe(100);
    });

    it('getCanvasSize halves', () => {
      const size = ct.getCanvasSize();
      expect(size.width).toBe(306);
      expect(size.height).toBe(396);
    });
  });

  describe('pdfToScreenRect / screenToPdfRect', () => {
    const ct = new CoordinateTransform(pageWidth, pageHeight, 1.0, 1);

    it('converts PDF rect to screen rect', () => {
      const pdfRect = { x: 100, y: 500, width: 200, height: 50 };
      const screenRect = ct.pdfToScreenRect(pdfRect);
      expect(screenRect.x).toBe(100);
      expect(screenRect.y).toBe(242); // 792 - (500 + 50) = 242
      expect(screenRect.width).toBe(200);
      expect(screenRect.height).toBe(50);
    });

    it('round-trips rects', () => {
      const original = { x: 100, y: 300, width: 150, height: 80 };
      const screen = ct.pdfToScreenRect(original);
      const back = ct.screenToPdfRect(screen);
      expect(back.x).toBeCloseTo(original.x);
      expect(back.y).toBeCloseTo(original.y);
      expect(back.width).toBeCloseTo(original.width);
      expect(back.height).toBeCloseTo(original.height);
    });
  });

  describe('setZoom', () => {
    it('updates zoom level', () => {
      const ct = new CoordinateTransform(pageWidth, pageHeight, 1.0, 1);
      expect(ct.getCanvasSize().width).toBe(612);
      ct.setZoom(3.0);
      expect(ct.getCanvasSize().width).toBe(1836);
    });
  });
});
