import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { editorReducer, initialEditorState, type EditorAction } from '../editor/reducer';
import type { Circuit } from '../model/types';
import { diagnostic } from '../solver/diagnostics';
import { solve, type SolveResult } from '../solver/solve';
import { EXAMPLES, type Example } from '../teaching/examples';
import { evaluatePrediction, predictionReducer } from '../teaching/prediction';
import { CircuitCanvas } from './CircuitCanvas';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import type { Highlight } from './ElementView';
import { PredictionPanel } from './PredictionPanel';
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

function buildHighlights(result: SolveResult, focusIds: readonly string[]): Map<string, Highlight> {
  const map = new Map<string, Highlight>();
  for (const id of focusIds) map.set(id, 'focus');
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
  const firstExample = EXAMPLES[0] as Example;
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    initialEditorState(firstExample.circuit),
  );
  const [prediction, predict] = useReducer(predictionReducer, { step: 'off' });
  const [note, setNote] = useState<Example | null>(firstExample);
  const [tool, setTool] = useState<Tool>('select');
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const result = useMemo(() => safeSolve(state.circuit), [state.circuit]);
  const focusIds = useMemo(() => {
    if (prediction.step === 'pickSwitch') return [prediction.bulbId];
    if (prediction.step === 'guess' || prediction.step === 'result') {
      return [prediction.bulbId, prediction.switchId];
    }
    return [];
  }, [prediction]);
  const highlights = useMemo(() => buildHighlights(result, focusIds), [result, focusIds]);
  const selected = state.circuit.elements.find((el) => el.id === state.selectedId);

  const revealPrediction = () => {
    if (prediction.step !== 'guess' || !prediction.guess) return;
    const { bulbId, switchId, guess } = prediction;
    predict({
      type: 'reveal',
      outcome: evaluatePrediction(state.circuit, bulbId, switchId, guess),
    });
    dispatch({ type: 'toggleSwitch', id: switchId });
  };

  /** 預測模式中，畫布上的點擊代表「選擇燈泡／開關」或「揭曉結果」 */
  const handleAction = (action: EditorAction) => {
    const kindOf = (id: string) => state.circuit.elements.find((el) => el.id === id)?.kind;
    if (prediction.step === 'pickBulb' && action.type === 'select' && action.id) {
      if (kindOf(action.id) === 'bulb') predict({ type: 'pickBulb', id: action.id });
    } else if (prediction.step === 'pickSwitch' && action.type === 'toggleSwitch') {
      predict({ type: 'pickSwitch', id: action.id });
      return;
    } else if (
      (prediction.step === 'guess' || prediction.step === 'result') &&
      action.type === 'toggleSwitch' &&
      action.id === prediction.switchId
    ) {
      revealPrediction();
      return;
    }
    dispatch(action);
  };

  const loadExample = (id: string) => {
    const example = EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    dispatch({ type: 'load', circuit: example.circuit });
    predict({ type: 'stop' });
    setNote(example);
  };

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
          <select
            aria-label="載入範例"
            value=""
            onChange={(e) => loadExample(e.target.value)}
            data-testid="example-select"
          >
            <option value="" disabled>
              📚 載入範例…
            </option>
            {EXAMPLES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
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
            dispatch={handleAction}
            svgRef={svgRef}
          />
        </div>
        <aside className="side">
          {note && (
            <section className="panel note" aria-label="範例說明">
              <h2>
                {note.title}
                <button
                  type="button"
                  className="close"
                  onClick={() => setNote(null)}
                  aria-label="關閉說明"
                >
                  ×
                </button>
              </h2>
              <p>{note.description}</p>
            </section>
          )}
          <PredictionPanel
            state={prediction}
            circuit={state.circuit}
            onAction={predict}
            onReveal={revealPrediction}
          />
          <DiagnosticsPanel
            diagnostics={result.diagnostics}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
          <PropertyPanel
            element={selected}
            result={selected ? result.elements.get(selected.id) : undefined}
            dispatch={handleAction}
          />
        </aside>
      </main>
    </div>
  );
}
