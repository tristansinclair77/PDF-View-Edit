import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from './annotationStore';

describe('AnnotationStore', () => {
  beforeEach(() => {
    // Reset the store between tests
    useAnnotationStore.setState({
      pageAnnotations: new Map(),
      undoStack: [],
      redoStack: [],
      pendingRedactions: [],
    });
  });

  describe('addAnnotation', () => {
    it('adds annotation to page', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      const annotations = useAnnotationStore.getState().getPageAnnotations(0);
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toBe('{"type":"rect"}');
    });

    it('adds to undo stack', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      expect(useAnnotationStore.getState().undoStack).toHaveLength(1);
      expect(useAnnotationStore.getState().undoStack[0].type).toBe('add');
    });

    it('clears redo stack on new action', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      // Simulate undo to populate redo
      store.undo();
      expect(useAnnotationStore.getState().redoStack).toHaveLength(1);
      // New action clears redo
      store.addAnnotation(0, '{"type":"line"}', 'ann_2');
      expect(useAnnotationStore.getState().redoStack).toHaveLength(0);
    });

    it('handles multiple pages independently', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      store.addAnnotation(1, '{"type":"line"}', 'ann_2');
      expect(useAnnotationStore.getState().getPageAnnotations(0)).toHaveLength(1);
      expect(useAnnotationStore.getState().getPageAnnotations(1)).toHaveLength(1);
    });
  });

  describe('removeAnnotation', () => {
    it('adds remove action to undo stack', () => {
      const store = useAnnotationStore.getState();
      store.removeAnnotation(0, 'ann_1', '{"type":"rect"}');
      expect(useAnnotationStore.getState().undoStack).toHaveLength(1);
      expect(useAnnotationStore.getState().undoStack[0].type).toBe('remove');
    });
  });

  describe('undo / redo', () => {
    it('undo returns last action and moves to redo stack', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      const action = store.undo();
      expect(action).not.toBeNull();
      expect(action!.type).toBe('add');
      expect(useAnnotationStore.getState().undoStack).toHaveLength(0);
      expect(useAnnotationStore.getState().redoStack).toHaveLength(1);
    });

    it('redo returns last undone action and moves to undo stack', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      store.undo();
      const action = useAnnotationStore.getState().redo();
      expect(action).not.toBeNull();
      expect(action!.type).toBe('add');
      expect(useAnnotationStore.getState().undoStack).toHaveLength(1);
      expect(useAnnotationStore.getState().redoStack).toHaveLength(0);
    });

    it('undo returns null when stack is empty', () => {
      const action = useAnnotationStore.getState().undo();
      expect(action).toBeNull();
    });

    it('redo returns null when stack is empty', () => {
      const action = useAnnotationStore.getState().redo();
      expect(action).toBeNull();
    });
  });

  describe('pendingRedactions', () => {
    it('adds pending redaction', () => {
      const store = useAnnotationStore.getState();
      store.addPendingRedaction({
        id: 'red_1',
        pageNum: 0,
        rect: { x: 10, y: 20, width: 100, height: 50 },
        fillColor: '#000000',
      });
      expect(useAnnotationStore.getState().pendingRedactions).toHaveLength(1);
    });

    it('removes pending redaction by id', () => {
      const store = useAnnotationStore.getState();
      store.addPendingRedaction({
        id: 'red_1',
        pageNum: 0,
        rect: { x: 10, y: 20, width: 100, height: 50 },
        fillColor: '#000000',
      });
      store.removePendingRedaction('red_1');
      expect(useAnnotationStore.getState().pendingRedactions).toHaveLength(0);
    });

    it('clears all pending redactions', () => {
      const store = useAnnotationStore.getState();
      store.addPendingRedaction({
        id: 'red_1', pageNum: 0,
        rect: { x: 0, y: 0, width: 10, height: 10 }, fillColor: '#000',
      });
      store.addPendingRedaction({
        id: 'red_2', pageNum: 1,
        rect: { x: 0, y: 0, width: 10, height: 10 }, fillColor: '#000',
      });
      store.clearPendingRedactions();
      expect(useAnnotationStore.getState().pendingRedactions).toHaveLength(0);
    });
  });

  describe('clearPage', () => {
    it('clears annotations for a specific page', () => {
      const store = useAnnotationStore.getState();
      store.addAnnotation(0, '{"type":"rect"}', 'ann_1');
      store.addAnnotation(1, '{"type":"line"}', 'ann_2');
      store.clearPage(0);
      expect(useAnnotationStore.getState().getPageAnnotations(0)).toHaveLength(0);
      expect(useAnnotationStore.getState().getPageAnnotations(1)).toHaveLength(1);
    });
  });
});
