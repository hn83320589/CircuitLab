import { describe, expect, it } from 'vitest';
import { createElement } from '../model/elements';
import type { Circuit, CircuitElement } from '../model/types';
import { solve } from '../solver/solve';
import { HISTORY_LIMIT, editorReducer, initialEditorState, type EditorState } from './reducer';

const empty: Circuit = { version: 1, elements: [] };

function apply(state: EditorState, ...actions: Parameters<typeof editorReducer>[1][]) {
  return actions.reduce(editorReducer, state);
}

function element(state: EditorState, id: string): CircuitElement {
  const el = state.circuit.elements.find((e) => e.id === id);
  if (!el) throw new Error(`找不到 ${id}`);
  return el;
}

const resistor = createElement('resistor', 'r1', { x: 10, y: 10 });

describe('editorReducer', () => {
  it('新增元件後自動選取，並記入歷史', () => {
    const state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    expect(state.circuit.elements).toEqual([resistor]);
    expect(state.selectedId).toBe('r1');
    expect(state.past).toHaveLength(1);
  });

  it('移動元件兩端一起位移；移出畫布則不動作', () => {
    let state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    state = apply(state, { type: 'move', id: 'r1', dx: 3, dy: -2 });
    expect(element(state, 'r1')).toMatchObject({ a: { x: 12, y: 8 }, b: { x: 14, y: 8 } });
    const before = state;
    state = apply(state, { type: 'move', id: 'r1', dx: -20, dy: 0 });
    expect(state).toBe(before);
  });

  it('旋轉 90° 以中點為軸，轉四次回到原位', () => {
    let state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    state = apply(state, { type: 'rotate', id: 'r1' });
    expect(element(state, 'r1')).toMatchObject({ a: { x: 10, y: 9 }, b: { x: 10, y: 11 } });
    state = apply(
      state,
      { type: 'rotate', id: 'r1' },
      { type: 'rotate', id: 'r1' },
      { type: 'rotate', id: 'r1' },
    );
    expect(element(state, 'r1')).toEqual(resistor);
  });

  it('刪除元件並取消選取', () => {
    const state = apply(
      initialEditorState(empty),
      { type: 'add', element: resistor },
      { type: 'delete', id: 'r1' },
    );
    expect(state.circuit.elements).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('修改數值；超出範圍或非數字則不動作', () => {
    let state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    state = apply(state, { type: 'setValue', id: 'r1', field: 'resistance', value: 47 });
    expect(element(state, 'r1')).toMatchObject({ resistance: 47 });
    const before = state;
    expect(apply(state, { type: 'setValue', id: 'r1', field: 'resistance', value: -1 })).toBe(
      before,
    );
    expect(apply(state, { type: 'setValue', id: 'r1', field: 'resistance', value: NaN })).toBe(
      before,
    );
    expect(apply(state, { type: 'setValue', id: 'r1', field: 'emf', value: 3 })).toBe(before);
  });

  it('切換開關', () => {
    const sw = createElement('switch', 's1', { x: 5, y: 5 });
    const state = apply(
      initialEditorState(empty),
      { type: 'add', element: sw },
      { type: 'toggleSwitch', id: 's1' },
    );
    expect(element(state, 's1')).toMatchObject({ closed: false });
  });

  it('拖曳導線端點；不允許長度為 0', () => {
    const wire: CircuitElement = { kind: 'wire', id: 'w1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
    let state = apply(initialEditorState(empty), { type: 'add', element: wire });
    state = apply(state, { type: 'moveEndpoint', id: 'w1', end: 'b', to: { x: 4, y: 3 } });
    expect(element(state, 'w1').b).toEqual({ x: 4, y: 3 });
    const before = state;
    expect(apply(state, { type: 'moveEndpoint', id: 'w1', end: 'b', to: { x: 0, y: 0 } })).toBe(
      before,
    );
  });

  it('選取不會記入歷史', () => {
    let state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    state = apply(state, { type: 'select', id: null }, { type: 'select', id: 'r1' });
    expect(state.past).toHaveLength(1);
  });
});

describe('Undo／Redo', () => {
  /** 產生 n 個交錯的編輯動作 */
  function edits(n: number) {
    const actions: Parameters<typeof editorReducer>[1][] = [
      { type: 'add', element: createElement('battery', 'b1', { x: 2, y: 2 }) },
      { type: 'add', element: createElement('bulb', 'l1', { x: 6, y: 2 }) },
      { type: 'add', element: { kind: 'wire', id: 'w1', a: { x: 3, y: 2 }, b: { x: 5, y: 2 } } },
      { type: 'add', element: { kind: 'wire', id: 'w2', a: { x: 7, y: 2 }, b: { x: 1, y: 2 } } },
    ];
    for (let i = actions.length; i < n; i++) {
      actions.push(
        i % 3 === 0
          ? { type: 'setValue', id: 'l1', field: 'resistance', value: 5 + i }
          : i % 3 === 1
            ? { type: 'setValue', id: 'b1', field: 'emf', value: 1 + (i % 7) }
            : { type: 'setValue', id: 'b1', field: 'internalR', value: ((i % 5) + 1) / 10 },
      );
    }
    return actions;
  }

  it('60 步全部復原後，電路與求解結果和原本完全相同；全部重做亦然', () => {
    const start = initialEditorState(empty);
    const snapshots = [start.circuit];
    let state = start;
    for (const action of edits(60)) {
      state = editorReducer(state, action);
      snapshots.push(state.circuit);
    }
    const final = state.circuit;
    for (let i = snapshots.length - 2; i >= 0; i--) {
      state = editorReducer(state, { type: 'undo' });
      expect(state.circuit).toEqual(snapshots[i]);
      expect(solve(state.circuit)).toEqual(solve(snapshots[i] as Circuit));
    }
    for (let i = 0; i < 60; i++) state = editorReducer(state, { type: 'redo' });
    expect(state.circuit).toEqual(final);
    expect(solve(state.circuit)).toEqual(solve(final));
  });

  it(`歷史上限 ${HISTORY_LIMIT} 步，且新編輯會清除 redo`, () => {
    let state = initialEditorState(empty);
    for (const action of edits(HISTORY_LIMIT + 20)) state = editorReducer(state, action);
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    state = apply(state, { type: 'undo' }, { type: 'undo' });
    expect(state.future).toHaveLength(2);
    state = apply(state, { type: 'toggleSwitch', id: 'nope' }, { type: 'rotate', id: 'l1' });
    expect(state.future).toHaveLength(0);
  });

  it('沒有歷史時 undo／redo 不動作', () => {
    const state = initialEditorState(empty);
    expect(apply(state, { type: 'undo' })).toBe(state);
    expect(apply(state, { type: 'redo' })).toBe(state);
  });

  it('載入電路可以復原', () => {
    const loaded: Circuit = { version: 1, elements: [resistor] };
    let state = apply(initialEditorState(empty), { type: 'load', circuit: loaded });
    expect(state.circuit).toBe(loaded);
    state = apply(state, { type: 'undo' });
    expect(state.circuit).toEqual(empty);
  });

  it('reset 以新電路開始一段新的歷史', () => {
    const loaded: Circuit = { version: 1, elements: [resistor] };
    let state = apply(initialEditorState(empty), { type: 'add', element: resistor });
    state = apply(state, { type: 'reset', circuit: loaded });
    expect(state).toEqual(initialEditorState(loaded));
  });
});
