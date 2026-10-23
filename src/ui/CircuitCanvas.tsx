import { useMemo, useRef, useState, type Dispatch, type PointerEvent } from 'react';
import type { EditorAction } from '../editor/reducer';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  createElement,
  nextElementId,
  translate,
} from '../model/elements';
import { pointKey, samePoint } from '../model/geometry';
import type { Circuit, CircuitElement, Point } from '../model/types';
import type { SolveResult } from '../solver/solve';
import { COLORS } from './colors';
import { ElementView, type Highlight } from './ElementView';
import type { Tool } from './tools';
import { CELL } from './visual';

interface CircuitCanvasProps {
  circuit: Circuit;
  result: SolveResult;
  selectedId: string | null;
  tool: Tool;
  showLabels: boolean;
  highlights: ReadonlyMap<string, Highlight>;
  dispatch: Dispatch<EditorAction>;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

type Gesture =
  | { kind: 'drag'; id: string; start: Point; delta: Point }
  | { kind: 'endpoint'; id: string; end: 'a' | 'b'; to: Point }
  | { kind: 'wire'; from: Point; to: Point };

const WIDTH = GRID_WIDTH * CELL;
const HEIGHT = GRID_HEIGHT * CELL;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function CircuitCanvas(props: CircuitCanvasProps) {
  const { circuit, result, selectedId, tool, showLabels, highlights, dispatch, svgRef } = props;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const downTarget = useRef<string | null>(null);

  const toGrid = (e: PointerEvent): Point => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return {
      x: clamp(Math.round(p.x / CELL), 0, GRID_WIDTH),
      y: clamp(Math.round(p.y / CELL), 0, GRID_HEIGHT),
    };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toGrid(e);
    const target = e.target as Element;
    const endpoint = target.closest('[data-endpoint]');
    const id = target.closest('[data-element-id]')?.getAttribute('data-element-id') ?? null;
    downTarget.current = id;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'wire') {
      setGesture({ kind: 'wire', from: p, to: p });
      return;
    }
    if (tool !== 'select') {
      const center = { x: clamp(p.x, 1, GRID_WIDTH - 1), y: p.y };
      dispatch({ type: 'add', element: createElement(tool, nextElementId(circuit), center) });
      return;
    }
    if (endpoint) {
      const end = endpoint.getAttribute('data-endpoint') as 'a' | 'b';
      const wireId = endpoint.getAttribute('data-wire-id') as string;
      setGesture({ kind: 'endpoint', id: wireId, end, to: p });
      return;
    }
    if (id) {
      dispatch({ type: 'select', id });
      setGesture({ kind: 'drag', id, start: p, delta: { x: 0, y: 0 } });
    } else {
      dispatch({ type: 'select', id: null });
    }
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = toGrid(e);
    setHover((h) => (h && samePoint(h, p) ? h : p));
    if (!gesture) return;
    if (gesture.kind === 'drag') {
      const delta = { x: p.x - gesture.start.x, y: p.y - gesture.start.y };
      if (!samePoint(delta, gesture.delta)) setGesture({ ...gesture, delta });
    } else if (!samePoint(gesture.to, p)) {
      setGesture({ ...gesture, to: p });
    }
  };

  const onPointerUp = () => {
    if (!gesture) return;
    if (gesture.kind === 'drag') {
      const { id, delta } = gesture;
      if (delta.x !== 0 || delta.y !== 0) {
        dispatch({ type: 'move', id, dx: delta.x, dy: delta.y });
      } else if (circuit.elements.find((el) => el.id === id)?.kind === 'switch') {
        // 沒有移動視為點擊：切換開關
        dispatch({ type: 'toggleSwitch', id });
      }
    } else if (gesture.kind === 'endpoint') {
      dispatch({ type: 'moveEndpoint', id: gesture.id, end: gesture.end, to: gesture.to });
    } else if (!samePoint(gesture.from, gesture.to)) {
      dispatch({
        type: 'add',
        element: { kind: 'wire', id: nextElementId(circuit), a: gesture.from, b: gesture.to },
      });
    }
    setGesture(null);
  };

  /** 拖曳中的預覽：只替換正在拖曳的那個元件 */
  const preview = (el: CircuitElement): CircuitElement => {
    if (!gesture || gesture.kind === 'wire' || gesture.id !== el.id) return el;
    if (gesture.kind === 'drag') return translate(el, gesture.delta.x, gesture.delta.y);
    return { ...el, [gesture.end]: gesture.to };
  };

  const junctions = useMemo(() => terminalMarks(circuit), [circuit]);
  // 先畫導線，元件畫在導線上方
  const ordered = useMemo(
    () => [
      ...circuit.elements.filter((el) => el.kind === 'wire'),
      ...circuit.elements.filter((el) => el.kind !== 'wire'),
    ],
    [circuit],
  );
  const selectedWire = circuit.elements.find((el) => el.id === selectedId && el.kind === 'wire');

  return (
    <svg
      ref={svgRef}
      className="circuit-canvas"
      viewBox={`${-CELL} ${-CELL} ${WIDTH + 2 * CELL} ${HEIGHT + 2 * CELL}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      data-tool={tool}
      role="application"
      aria-label="電路畫布"
    >
      <defs>
        <pattern id="grid-dots" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={1.2} fill={COLORS.grid} />
          <circle cx={CELL} cy={0} r={1.2} fill={COLORS.grid} />
          <circle cx={0} cy={CELL} r={1.2} fill={COLORS.grid} />
          <circle cx={CELL} cy={CELL} r={1.2} fill={COLORS.grid} />
        </pattern>
      </defs>
      <rect
        x={-CELL}
        y={-CELL}
        width={WIDTH + 2 * CELL}
        height={HEIGHT + 2 * CELL}
        fill="#ffffff"
      />
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#grid-dots)" />

      {ordered.map((el) => (
        <ElementView
          key={el.id}
          element={preview(el)}
          result={result.elements.get(el.id)}
          selected={el.id === selectedId}
          highlight={highlights.get(el.id)}
          showLabels={showLabels}
        />
      ))}

      {junctions.map(({ point, count }) =>
        count === 1 ? (
          <circle
            key={pointKey(point)}
            cx={point.x * CELL}
            cy={point.y * CELL}
            r={3}
            fill="#ffffff"
            stroke={COLORS.warning}
            strokeWidth={1.5}
            pointerEvents="none"
          />
        ) : (
          <circle
            key={pointKey(point)}
            cx={point.x * CELL}
            cy={point.y * CELL}
            r={3.2}
            fill={COLORS.ink}
            pointerEvents="none"
          />
        ),
      )}

      {selectedWire &&
        (['a', 'b'] as const).map((end) => {
          const p = preview(selectedWire)[end];
          return (
            <circle
              key={end}
              data-endpoint={end}
              data-wire-id={selectedWire.id}
              cx={p.x * CELL}
              cy={p.y * CELL}
              r={6}
              fill="#ffffff"
              stroke={COLORS.selected}
              strokeWidth={2}
              style={{ cursor: 'move' }}
            />
          );
        })}

      {gesture?.kind === 'wire' && (
        <line
          x1={gesture.from.x * CELL}
          y1={gesture.from.y * CELL}
          x2={gesture.to.x * CELL}
          y2={gesture.to.y * CELL}
          stroke={COLORS.selected}
          strokeWidth={2}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}

      {hover && tool !== 'select' && !gesture && (
        <circle
          cx={hover.x * CELL}
          cy={hover.y * CELL}
          r={5}
          fill="none"
          stroke={COLORS.selected}
          strokeWidth={1.5}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

/** 端點標記：只有一個端點的格點（沒接上）與三個以上端點交會的格點（接點） */
function terminalMarks(circuit: Circuit): { point: Point; count: number }[] {
  const counts = new Map<string, { point: Point; count: number }>();
  for (const el of circuit.elements) {
    for (const p of [el.a, el.b]) {
      const entry = counts.get(pointKey(p));
      if (entry) entry.count++;
      else counts.set(pointKey(p), { point: p, count: 1 });
    }
  }
  return [...counts.values()].filter(({ count }) => count === 1 || count >= 3);
}
