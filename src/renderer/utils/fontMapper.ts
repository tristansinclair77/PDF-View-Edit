/**
 * Maps PDF font names to available system/web fonts.
 * PDF fonts often have names like "ABCDEF+ArialMT" or "TimesNewRomanPSMT".
 */

const FONT_MAP: Record<string, string> = {
  // Standard 14 PDF fonts
  'Courier': 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  'Courier-BoldOblique': 'Courier New',
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Helvetica-BoldOblique': 'Arial',
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'Times-BoldItalic': 'Times New Roman',
  'Symbol': 'Symbol',
  'ZapfDingbats': 'Wingdings',

  // Common variations
  'ArialMT': 'Arial',
  'Arial-BoldMT': 'Arial',
  'Arial-ItalicMT': 'Arial',
  'Arial-BoldItalicMT': 'Arial',
  'TimesNewRomanPSMT': 'Times New Roman',
  'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'TimesNewRomanPS-ItalicMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New',
  'CalibrI': 'Calibri',
  'Calibri': 'Calibri',
  'Calibri-Bold': 'Calibri',
  'Cambria': 'Cambria',
  'Georgia': 'Georgia',
  'Verdana': 'Verdana',
  'Tahoma': 'Tahoma',
  'Trebuchet MS': 'Trebuchet MS',
};

export interface FontMatch {
  family: string;
  weight: string;
  style: string;
  isExact: boolean;
}

export function mapPdfFont(pdfFontName: string): FontMatch {
  // Strip subset prefix (e.g., "ABCDEF+" prefix)
  let cleanName = pdfFontName.replace(/^[A-Z]{6}\+/, '');

  // Check direct mapping first
  if (FONT_MAP[cleanName]) {
    const isBold = /Bold/i.test(cleanName);
    const isItalic = /Italic|Oblique/i.test(cleanName);
    return {
      family: FONT_MAP[cleanName],
      weight: isBold ? 'bold' : 'normal',
      style: isItalic ? 'italic' : 'normal',
      isExact: true,
    };
  }

  // Try fuzzy matching
  const lower = cleanName.toLowerCase();
  const isBold = /bold/i.test(lower);
  const isItalic = /italic|oblique/i.test(lower);

  // Strip weight/style suffixes for base name matching
  const baseName = cleanName
    .replace(/-?(Bold|Italic|Oblique|Regular|Light|Medium|Thin|Black|Heavy|BoldItalic|BoldOblique)/gi, '')
    .replace(/MT$/, '')
    .replace(/PS$/, '')
    .trim();

  // Check if base name matches
  for (const [pdfName, systemFont] of Object.entries(FONT_MAP)) {
    if (pdfName.toLowerCase().startsWith(baseName.toLowerCase())) {
      return {
        family: systemFont,
        weight: isBold ? 'bold' : 'normal',
        style: isItalic ? 'italic' : 'normal',
        isExact: false,
      };
    }
  }

  // Fallback: try using the font name directly (might be a system font)
  // If it contains "Sans", use Arial; if "Serif", use Times; else Arial
  if (/sans/i.test(cleanName)) {
    return { family: 'Arial', weight: isBold ? 'bold' : 'normal', style: isItalic ? 'italic' : 'normal', isExact: false };
  }
  if (/serif/i.test(cleanName) || /roman/i.test(cleanName)) {
    return { family: 'Times New Roman', weight: isBold ? 'bold' : 'normal', style: isItalic ? 'italic' : 'normal', isExact: false };
  }
  if (/mono|courier|code/i.test(cleanName)) {
    return { family: 'Courier New', weight: isBold ? 'bold' : 'normal', style: isItalic ? 'italic' : 'normal', isExact: false };
  }

  // Last resort: use the clean name as-is (system might have it) with Arial fallback
  return {
    family: `${baseName || cleanName}, Arial`,
    weight: isBold ? 'bold' : 'normal',
    style: isItalic ? 'italic' : 'normal',
    isExact: false,
  };
}
