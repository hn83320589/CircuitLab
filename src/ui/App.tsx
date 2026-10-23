import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { downloadBlob, svgToPngBlob } from '../io/exportPng';
import { parseCircuit, serializeCircuit } from '../io/serialize';
import { buildShareUrl, decodeShareFragment, readShareFragment } from '../io/shareLink';
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
import { Toast, type ToastMessage } from './Toast';
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 開啟分享連結：以連結中的電路開始新的歷史。
  // 在已開啟的分頁貼上新連結只會觸發 hashchange（不會重新載入頁面），所以也要監聽。
  useEffect(() => {
    let disposed = false;
    let latestRequest = 0;
    const loadFromHash = () => {
      const fragment = readShareFragment(window.location.hash);
      if (!fragment) return;
      const request = ++latestRequest;
      void decodeShareFragment(fragment).then((parsed) => {
        // 元件已卸載，或有更新的連結正在處理
        if (disposed || request !== latestRequest) return;
        if (parsed.ok) {
          dispatch({ type: 'reset', circuit: parsed.circuit });
          predict({ type: 'stop' });
          setNote(null);
        } else {
          setToast({ text: parsed.error, kind: 'error' });
        }
      });
    };
    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);
    return () => {
      disposed = true;
      window.removeEventListener('hashchange', loadFromHash);
    };
  }, []);

  useEffect(() => {
    if (!toast || toast.link) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveJson = () => {
    const blob = new Blob([serializeCircuit(state.circuit)], { type: 'application/json' });
    downloadBlob(blob, 'circuit.json');
  };

  const openJson = async (file: File) => {
    const parsed = parseCircuit(await file.text());
    if (parsed.ok) {
      dispatch({ type: 'load', circuit: parsed.circuit });
      predict({ type: 'stop' });
      setNote(null);
      setToast({ text: `已開啟 ${file.name}`, kind: 'info' });
    } else {
      setToast({ text: `無法開啟 ${file.name}：${parsed.error}`, kind: 'error' });
    }
  };

  const share = async () => {
    const url = await buildShareUrl(
      state.circuit,
      window.location.origin + window.location.pathname,
    );
    try {
      await navigator.clipboard.writeText(url);
      setToast({ text: '已複製分享連結，貼給學生就能開啟這個電路。', kind: 'info' });
    } catch {
      setToast({ text: '請複製下面的分享連結：', kind: 'info', link: url });
    }
  };

  const exportPng = async () => {
    if (!svgRef.current) return;
    try {
      downloadBlob(await svgToPngBlob(svgRef.current), 'circuit.png');
    } catch (error) {
      console.error(error);
      setToast({ text: '匯出圖片失敗，請再試一次。', kind: 'error' });
    }
  };

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
          <button type="button" onClick={saveJson} title="下載電路檔（JSON）">
            💾 存檔
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} title="開啟電路檔（JSON）">
            📂 開啟
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void openJson(file);
            }}
          />
          <button type="button" onClick={() => void share()} title="產生分享連結">
            🔗 分享連結
          </button>
          <button type="button" onClick={() => void exportPng()} title="匯出畫布為 PNG">
            🖼 匯出 PNG
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
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
