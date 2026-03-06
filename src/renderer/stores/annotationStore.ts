import { create } from 'zustand';

export interface AnnotationAction {
  type: 'add' | 'remove' | 'modify';
  pageNum: number;
  objectId: string;
  data: string; // Serialized Fabric.js object JSON
  previousData?: string; // For modify actions
}

interface AnnotationState {
  // Per-page serialized annotation data (Fabric.js JSON)
  pageAnnotations: Map<number, string[]>;
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];
  pendingRedactions: Array<{
    id: string;
    pageNum: number;
    rect: { x: number; y: number; width: number; height: number };
    fillColor: string;
    overlayText?: string;
  }>;

  addAnnotation: (pageNum: number, objectJson: string, objectId: string) => void;
  removeAnnotation: (pageNum: number, objectId: string, objectJson: string) => void;
  modifyAnnotation: (pageNum: number, objectId: string, newJson: string, oldJson: string) => void;
  undo: () => AnnotationAction | null;
  redo: () => AnnotationAction | null;
  clearPage: (pageNum: number) => void;
  getPageAnnotations: (pageNum: number) => string[];

  addPendingRedaction: (redaction: {
    id: string;
    pageNum: number;
    rect: { x: number; y: number; width: number; height: number };
    fillColor: string;
    overlayText?: string;
  }) => void;
  removePendingRedaction: (id: string) => void;
  clearPendingRedactions: () => void;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  pageAnnotations: new Map(),
  undoStack: [],
  redoStack: [],
  pendingRedactions: [],

  addAnnotation: (pageNum, objectJson, objectId) => {
    const action: AnnotationAction = {
      type: 'add',
      pageNum,
      objectId,
      data: objectJson,
    };
    set((state) => {
      const map = new Map(state.pageAnnotations);
      const existing = map.get(pageNum) || [];
      map.set(pageNum, [...existing, objectJson]);
      return {
        pageAnnotations: map,
        undoStack: [...state.undoStack, action],
        redoStack: [],
      };
    });
  },

  removeAnnotation: (pageNum, objectId, objectJson) => {
    const action: AnnotationAction = {
      type: 'remove',
      pageNum,
      objectId,
      data: objectJson,
    };
    set((state) => ({
      undoStack: [...state.undoStack, action],
      redoStack: [],
    }));
  },

  modifyAnnotation: (pageNum, objectId, newJson, oldJson) => {
    const action: AnnotationAction = {
      type: 'modify',
      pageNum,
      objectId,
      data: newJson,
      previousData: oldJson,
    };
    set((state) => ({
      undoStack: [...state.undoStack, action],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const action = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
    }));
    return action;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const action = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
    }));
    return action;
  },

  clearPage: (pageNum) => {
    set((state) => {
      const map = new Map(state.pageAnnotations);
      map.delete(pageNum);
      return { pageAnnotations: map };
    });
  },

  getPageAnnotations: (pageNum) => {
    return get().pageAnnotations.get(pageNum) || [];
  },

  addPendingRedaction: (redaction) => {
    set((state) => ({
      pendingRedactions: [...state.pendingRedactions, redaction],
    }));
  },

  removePendingRedaction: (id) => {
    set((state) => ({
      pendingRedactions: state.pendingRedactions.filter((r) => r.id !== id),
    }));
  },

  clearPendingRedactions: () => {
    set({ pendingRedactions: [] });
  },
}));
