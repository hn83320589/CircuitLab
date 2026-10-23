import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { editorReducer, initialEditorState } from '../editor/reducer';
import type { Circuit } from '../model/types';
import { diagnostic } from '../solver/diagnostics';
import { solve, type SolveResult } from '../solver/solve';
import { EXAMPLES } from '../teaching/examples';
import { CircuitCanvas } from './CircuitCanvas';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import type { Highlight } from './ElementView';
import { PropertyPanel } from './PropertyPanel';
import { Toolbar } from './Toolbar';
import { TOOLS, type Tool } from './tools';

/** 求解器若有未預期的例外，改以錯誤訊息呈現，畫面不會當掉 */
function safeSolve(circuit: Circuit): SolveResult {
  try {
    return solve(circuit);
  } catch (error) {
    console.error('求解時發生未預期的錯誤', error);
    return {
      elements: new Map(circuit.elements.map((el) => [el.id, null])),
      diagnostics: [
        diagnostic(
          'SINGULAR',
          circuit.elements.map((el) => el.id),
        ),
      ],
    };
  }
}

function buildHighlights(result: SolveResult): Map<string, Highlight> {
  const map = new Map<string, Highlight>();
  for (const d of result.diagnostics) {
    for (const id of d.elementIds) {
      if (map.get(id) !== 'error') map.set(id, d.severity);
    }
  }
  return map;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    initialEditorState((EXAMPLES[0] as (typeof EXAMPLES)[number]).circuit),
  );
  const [tool, setTool] = useState<Tool>('select');
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const result = useMemo(() => safeSolve(state.circuit), [state.circuit]);
  const highlights = useMemo(() => buildHighlights(result), [result]);
  const selected = state.circuit.elements.find((el) => el.id === state.selectedId);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod) {
        return;
      } else if (key === 'r' && state.selectedId) {
        dispatch({ type: 'rotate', id: state.selectedId });
      } else if ((key === 'delete' || key === 'backspace') && state.selectedId) {
        e.preventDefault();
        dispatch({ type: 'delete', id: state.selectedId });
      } else if (key === 'escape') {
        setTool('select');
        dispatch({ type: 'select', id: null });
      } else if (/^[1-8]$/.test(key)) {
        setTool((TOOLS[Number(key) - 1] as (typeof TOOLS)[number]).tool);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedId]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          CircuitLab Jr. <small>直流電路模擬教具</small>
        </h1>
        <div className="actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={state.past.length === 0}
            title="復原（Ctrl+Z）"
          >
            ↶ 復原
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'redo' })}
            disabled={state.future.length === 0}
            title="重做（Ctrl+Shift+Z）"
          >
            ↷ 重做
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            顯示數值
          </label>
        </div>
      </header>
      <main className="workspace">
        <Toolbar tool={tool} onChange={setTool} />
        <div className="canvas-wrap">
          <CircuitCanvas
            circuit={state.circuit}
            result={result}
            selectedId={state.selectedId}
            tool={tool}
            showLabels={showLabels}
            highlights={highlights}
            dispatch={dispatch}
            svgRef={svgRef}
          />
        </div>
        <aside className="side">
          <DiagnosticsPanel
            diagnostics={result.diagnostics}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
          <PropertyPanel
            element={selected}
            result={selected ? result.elements.get(selected.id) : undefined}
            dispatch={dispatch}
          />
        </aside>
      </main>
    </div>
  );
}
