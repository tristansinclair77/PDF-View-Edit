import { create } from 'zustand';

export type ToolType =
  | 'select'
  | 'editText'
  | 'addImage'
  | 'signature'
  | 'redact'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'freehand'
  | 'textBox'
  | 'highlight';

interface ToolState {
  activeTool: ToolType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  strokeDash: number[];
  recentColors: string[];
  editAllTextTrigger: number;

  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setStrokeDash: (dash: number[]) => void;
  addRecentColor: (color: string) => void;
  triggerEditAllText: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  activeTool: 'select',
  strokeColor: '#000000',
  fillColor: 'transparent',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 14,
  fontFamily: 'Arial',
  strokeDash: [],
  recentColors: [],
  editAllTextTrigger: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => {
    set({ strokeColor: color });
    get().addRecentColor(color);
  },
  setFillColor: (color) => {
    set({ fillColor: color });
    if (color !== 'transparent') get().addRecentColor(color);
  },
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setOpacity: (opacity) => set({ opacity: Math.max(0, Math.min(1, opacity)) }),
  setFontSize: (size) => set({ fontSize: size }),
  setFontFamily: (family) => set({ fontFamily: family }),
  setStrokeDash: (dash) => set({ strokeDash: dash }),
  addRecentColor: (color) => {
    const { recentColors } = get();
    const filtered = recentColors.filter((c) => c !== color);
    set({ recentColors: [color, ...filtered].slice(0, 8) });
  },
  triggerEditAllText: () => set((s) => ({ editAllTextTrigger: s.editAllTextTrigger + 1, activeTool: 'editText' as ToolType })),
}));
