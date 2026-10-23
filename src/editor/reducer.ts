import {
  isInsideGrid,
  isValidValue,
  rotate90,
  translate,
  type ValueField,
} from '../model/elements';
import { samePoint } from '../model/geometry';
import type { Circuit, CircuitElement, Point } from '../model/types';

/** 需求是至少 50 步 */
export const HISTORY_LIMIT = 100;

export interface EditorState {
  readonly circuit: Circuit;
  readonly past: readonly Circuit[];
  readonly future: readonly Circuit[];
  readonly selectedId: string | null;
}

export type EditorAction =
  | { type: 'add'; element: CircuitElement }
  | { type: 'move'; id: string; dx: number; dy: number }
  | { type: 'moveEndpoint'; id: string; end: 'a' | 'b'; to: Point }
  | { type: 'rotate'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'setValue'; id: string; field: ValueField; value: number }
  | { type: 'toggleSwitch'; id: string }
  | { type: 'load'; circuit: Circuit }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'redo' };

export function initialEditorState(circuit: Circuit): EditorState {
  return { circuit, past: [], future: [], selectedId: null };
}

/** 寫入新的電路並記入歷史；電路沒有變化時回傳原狀態。 */
function commit(state: EditorState, circuit: Circuit, selectedId = state.selectedId): EditorState {
  if (circuit === state.circuit) return state;
  return {
    circuit,
    past: [...state.past, state.circuit].slice(-HISTORY_LIMIT),
    future: [],
    selectedId,
  };
}

/** 以 update 取代指定元件；update 回傳 null 代表此操作不合法，電路維持不變。 */
function replaceElement(
  circuit: Circuit,
  id: string,
  update: (el: CircuitElement) => CircuitElement | null,
): Circuit {
  const index = circuit.elements.findIndex((el) => el.id === id);
  const current = circuit.elements[index];
  if (!current) return circuit;
  const next = update(current);
  if (!next || next === current) return circuit;
  const elements = circuit.elements.slice();
  elements[index] = next;
  return { ...circuit, elements };
}

const insideGrid = (el: CircuitElement) => (isInsideGrid(el.a) && isInsideGrid(el.b) ? el : null);

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { circuit } = state;
  switch (action.type) {
    case 'add': {
      if (
        !insideGrid(action.element) ||
        circuit.elements.some((el) => el.id === action.element.id)
      ) {
        return state;
      }
      return commit(
        state,
        { ...circuit, elements: [...circuit.elements, action.element] },
        action.element.id,
      );
    }
    case 'move':
      if (action.dx === 0 && action.dy === 0) return state;
      return commit(
        state,
        replaceElement(circuit, action.id, (el) => insideGrid(translate(el, action.dx, action.dy))),
      );
    case 'moveEndpoint':
      return commit(
        state,
        replaceElement(circuit, action.id, (el) => {
          if (el.kind !== 'wire') return null;
          const moved = { ...el, [action.end]: action.to };
          return samePoint(moved.a, moved.b) ? null : insideGrid(moved);
        }),
      );
    case 'rotate':
      return commit(
        state,
        replaceElement(circuit, action.id, (el) => insideGrid(rotate90(el))),
      );
    case 'delete': {
      const elements = circuit.elements.filter((el) => el.id !== action.id);
      if (elements.length === circuit.elements.length) return state;
      return commit(state, { ...circuit, elements }, null);
    }
    case 'setValue':
      if (!isValidValue(action.field, action.value)) return state;
      return commit(
        state,
        replaceElement(circuit, action.id, (el) => {
          if (!(action.field in el)) return null;
          if ((el as unknown as Record<string, number>)[action.field] === action.value) return null;
          return { ...el, [action.field]: action.value };
        }),
      );
    case 'toggleSwitch':
      return commit(
        state,
        replaceElement(circuit, action.id, (el) =>
          el.kind === 'switch' ? { ...el, closed: !el.closed } : null,
        ),
      );
    case 'load':
      return commit(state, action.circuit, null);
    case 'select':
      return action.id === state.selectedId ? state : { ...state, selectedId: action.id };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        circuit: previous,
        past: state.past.slice(0, -1),
        future: [circuit, ...state.future],
        selectedId: keepSelection(previous, state.selectedId),
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        circuit: next,
        past: [...state.past, circuit],
        future: state.future.slice(1),
        selectedId: keepSelection(next, state.selectedId),
      };
    }
  }
}

function keepSelection(circuit: Circuit, id: string | null): string | null {
  return id !== null && circuit.elements.some((el) => el.id === id) ? id : null;
}
