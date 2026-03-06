import { describe, it, expect, beforeEach } from 'vitest';
import { useToolStore } from './toolStore';

describe('ToolStore', () => {
  beforeEach(() => {
    useToolStore.setState({
      activeTool: 'select',
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 2,
      opacity: 1,
      fontSize: 14,
      fontFamily: 'Arial',
      strokeDash: [],
      recentColors: [],
    });
  });

  it('starts with select tool', () => {
    expect(useToolStore.getState().activeTool).toBe('select');
  });

  it('switches active tool', () => {
    useToolStore.getState().setActiveTool('rect');
    expect(useToolStore.getState().activeTool).toBe('rect');
  });

  it('sets stroke color and adds to recent', () => {
    useToolStore.getState().setStrokeColor('#ff0000');
    expect(useToolStore.getState().strokeColor).toBe('#ff0000');
    expect(useToolStore.getState().recentColors).toContain('#ff0000');
  });

  it('sets fill color', () => {
    useToolStore.getState().setFillColor('#00ff00');
    expect(useToolStore.getState().fillColor).toBe('#00ff00');
  });

  it('transparent fill does not add to recent colors', () => {
    useToolStore.getState().setFillColor('transparent');
    expect(useToolStore.getState().recentColors).toHaveLength(0);
  });

  it('clamps opacity to 0-1', () => {
    useToolStore.getState().setOpacity(1.5);
    expect(useToolStore.getState().opacity).toBe(1);
    useToolStore.getState().setOpacity(-0.5);
    expect(useToolStore.getState().opacity).toBe(0);
  });

  it('keeps max 8 recent colors', () => {
    const store = useToolStore.getState();
    for (let i = 0; i < 12; i++) {
      store.setStrokeColor(`#${i.toString().padStart(6, '0')}`);
    }
    expect(useToolStore.getState().recentColors.length).toBeLessThanOrEqual(8);
  });

  it('deduplicates recent colors', () => {
    const store = useToolStore.getState();
    store.setStrokeColor('#ff0000');
    store.setStrokeColor('#00ff00');
    store.setStrokeColor('#ff0000'); // duplicate
    expect(useToolStore.getState().recentColors.filter(c => c === '#ff0000')).toHaveLength(1);
  });

  it('sets font size and family', () => {
    const store = useToolStore.getState();
    store.setFontSize(24);
    store.setFontFamily('Georgia');
    expect(useToolStore.getState().fontSize).toBe(24);
    expect(useToolStore.getState().fontFamily).toBe('Georgia');
  });

  it('sets stroke width', () => {
    useToolStore.getState().setStrokeWidth(5);
    expect(useToolStore.getState().strokeWidth).toBe(5);
  });

  it('sets stroke dash', () => {
    useToolStore.getState().setStrokeDash([5, 3]);
    expect(useToolStore.getState().strokeDash).toEqual([5, 3]);
  });
});
