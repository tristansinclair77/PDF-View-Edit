/**
 * Converts between PDF coordinate space (points, origin at bottom-left)
 * and screen coordinate space (pixels, origin at top-left).
 */
export class CoordinateTransform {
  constructor(
    private pageWidth: number,   // PDF page width in points
    private pageHeight: number,  // PDF page height in points
    private zoom: number,
    private dpr: number = window.devicePixelRatio
  ) {}

  /** Convert PDF point X to screen pixel X */
  pdfToScreenX(pdfX: number): number {
    return pdfX * this.zoom;
  }

  /** Convert PDF point Y to screen pixel Y (flips Y axis) */
  pdfToScreenY(pdfY: number): number {
    return (this.pageHeight - pdfY) * this.zoom;
  }

  /** Convert screen pixel X to PDF point X */
  screenToPdfX(screenX: number): number {
    return screenX / this.zoom;
  }

  /** Convert screen pixel Y to PDF point Y (flips Y axis) */
  screenToPdfY(screenY: number): number {
    return this.pageHeight - screenY / this.zoom;
  }

  /** Convert PDF width to screen width */
  pdfToScreenWidth(pdfWidth: number): number {
    return pdfWidth * this.zoom;
  }

  /** Convert PDF height to screen height */
  pdfToScreenHeight(pdfHeight: number): number {
    return pdfHeight * this.zoom;
  }

  /** Convert screen width to PDF width */
  screenToPdfWidth(screenWidth: number): number {
    return screenWidth / this.zoom;
  }

  /** Convert screen height to PDF height */
  screenToPdfHeight(screenHeight: number): number {
    return screenHeight / this.zoom;
  }

  /** Convert a PDF rect to screen rect */
  pdfToScreenRect(pdfRect: { x: number; y: number; width: number; height: number }): {
    x: number; y: number; width: number; height: number;
  } {
    return {
      x: this.pdfToScreenX(pdfRect.x),
      y: this.pdfToScreenY(pdfRect.y + pdfRect.height), // top-left in screen coords
      width: this.pdfToScreenWidth(pdfRect.width),
      height: this.pdfToScreenHeight(pdfRect.height),
    };
  }

  /** Convert a screen rect to PDF rect */
  screenToPdfRect(screenRect: { x: number; y: number; width: number; height: number }): {
    x: number; y: number; width: number; height: number;
  } {
    return {
      x: this.screenToPdfX(screenRect.x),
      y: this.screenToPdfY(screenRect.y + screenRect.height), // bottom-left in PDF coords
      width: this.screenToPdfWidth(screenRect.width),
      height: this.screenToPdfHeight(screenRect.height),
    };
  }

  /** Get the canvas dimensions for this page at current zoom */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.pageWidth * this.zoom,
      height: this.pageHeight * this.zoom,
    };
  }

  /** Update zoom level */
  setZoom(zoom: number): void {
    this.zoom = zoom;
  }
}
