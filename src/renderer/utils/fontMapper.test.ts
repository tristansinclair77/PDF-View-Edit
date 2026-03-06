import { describe, it, expect } from 'vitest';
import { mapPdfFont } from './fontMapper';

describe('mapPdfFont', () => {
  describe('standard 14 PDF fonts', () => {
    it('maps Helvetica to Arial', () => {
      const result = mapPdfFont('Helvetica');
      expect(result.family).toBe('Arial');
      expect(result.isExact).toBe(true);
      expect(result.weight).toBe('normal');
      expect(result.style).toBe('normal');
    });

    it('maps Helvetica-Bold', () => {
      const result = mapPdfFont('Helvetica-Bold');
      expect(result.family).toBe('Arial');
      expect(result.weight).toBe('bold');
      expect(result.style).toBe('normal');
      expect(result.isExact).toBe(true);
    });

    it('maps Helvetica-Oblique', () => {
      const result = mapPdfFont('Helvetica-Oblique');
      expect(result.family).toBe('Arial');
      expect(result.style).toBe('italic');
    });

    it('maps Times-Roman', () => {
      const result = mapPdfFont('Times-Roman');
      expect(result.family).toBe('Times New Roman');
      expect(result.isExact).toBe(true);
    });

    it('maps Courier', () => {
      const result = mapPdfFont('Courier');
      expect(result.family).toBe('Courier New');
      expect(result.isExact).toBe(true);
    });

    it('maps Symbol', () => {
      expect(mapPdfFont('Symbol').family).toBe('Symbol');
    });

    it('maps ZapfDingbats', () => {
      expect(mapPdfFont('ZapfDingbats').family).toBe('Wingdings');
    });
  });

  describe('subset prefix stripping', () => {
    it('strips ABCDEF+ prefix', () => {
      const result = mapPdfFont('ABCDEF+ArialMT');
      expect(result.family).toBe('Arial');
      expect(result.isExact).toBe(true);
    });

    it('strips ZXYWVU+ prefix', () => {
      const result = mapPdfFont('ZXYWVU+Helvetica-Bold');
      expect(result.family).toBe('Arial');
      expect(result.weight).toBe('bold');
    });
  });

  describe('common font variations', () => {
    it('maps ArialMT', () => {
      expect(mapPdfFont('ArialMT').family).toBe('Arial');
    });

    it('maps TimesNewRomanPSMT', () => {
      expect(mapPdfFont('TimesNewRomanPSMT').family).toBe('Times New Roman');
    });

    it('maps CourierNewPSMT', () => {
      expect(mapPdfFont('CourierNewPSMT').family).toBe('Courier New');
    });

    it('maps Calibri', () => {
      expect(mapPdfFont('Calibri').family).toBe('Calibri');
    });
  });

  describe('fuzzy fallback matching', () => {
    it('falls back to Arial for unknown sans fonts', () => {
      const result = mapPdfFont('NotoSans-Regular');
      expect(result.family).toBe('Arial');
      expect(result.isExact).toBe(false);
    });

    it('falls back to Times New Roman for serif fonts', () => {
      const result = mapPdfFont('LinuxLibertine-Regular');
      // Contains no "serif" keyword, so will go to last-resort
      expect(result.isExact).toBe(false);
    });

    it('falls back to Courier New for mono fonts', () => {
      const result = mapPdfFont('SourceCodePro-Regular');
      // Contains "Code"
      expect(result.family).toBe('Courier New');
      expect(result.isExact).toBe(false);
    });
  });

  describe('weight and style detection', () => {
    it('detects Bold in name', () => {
      const result = mapPdfFont('SomeUnknownFont-Bold');
      expect(result.weight).toBe('bold');
    });

    it('detects Italic in name', () => {
      const result = mapPdfFont('SomeUnknownFont-Italic');
      expect(result.style).toBe('italic');
    });

    it('detects Oblique as italic', () => {
      const result = mapPdfFont('Courier-Oblique');
      expect(result.style).toBe('italic');
    });
  });
});
