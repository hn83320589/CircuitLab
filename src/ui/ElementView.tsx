import { memo, type ReactNode } from 'react';
import { formatNumber, formatParameter } from '../format';
import type { CircuitElement } from '../model/types';
import type { ElementResult } from '../solver/solve';
import { COLORS } from './colors';
import { CELL, bulbBrightness, flowDurationSeconds } from './visual';

/** focus：預測模式中被選定的燈泡與開關 */
export type Highlight = 'error' | 'warning' | 'focus';

interface ElementViewProps {
  element: CircuitElement;
  /** undefined：尚未求解；null：無法得到數值 */
  result: ElementResult | null | undefined;
  selected: boolean;
  highlight: Highlight | undefined;
  showLabels: boolean;
}

const STROKE = 2;

function ElementViewImpl({ element, result, selected, highlight, showLabels }: ElementViewProps) {
  const ax = element.a.x * CELL;
  const ay = element.a.y * CELL;
  const bx = element.b.x * CELL;
  const by = element.b.y * CELL;
  const length = Math.hypot(bx - ax, by - ay);
  const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
  const horizontal = Math.abs(bx - ax) >= Math.abs(by - ay);
  const haloColor = highlight ? COLORS[highlight] : selected ? COLORS.selected : null;

  return (
    <g data-element-id={element.id} data-kind={element.kind}>
      {haloColor && (
        <line
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          stroke={haloColor}
          strokeOpacity={0.3}
          strokeWidth={16}
          strokeLinecap="round"
        />
      )}
      {element.kind === 'wire' ? (
        <WireBody ax={ax} ay={ay} bx={bx} by={by} current={result?.current} />
      ) : (
        <g transform={`translate(${ax} ${ay}) rotate(${angle})`}>
          <Symbol element={element} length={length} />
        </g>
      )}
      <CenterDecoration element={element} result={result} x={mid.x} y={mid.y} />
      {element.kind !== 'wire' && (
        <ParameterTag element={element} x={mid.x} y={mid.y} horizontal={horizontal} />
      )}
      {showLabels && element.kind !== 'wire' && (
        <ResultLabel
          element={element}
          result={result}
          x={mid.x}
          y={mid.y}
          horizontal={horizontal}
        />
      )}
      {/* 透明的粗線作為點選範圍 */}
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="transparent"
        strokeWidth={16}
        strokeLinecap="round"
        style={{ cursor: 'pointer' }}
      />
    </g>
  );
}

function WireBody(props: { ax: number; ay: number; bx: number; by: number; current?: number }) {
  const { ax, ay, bx, by, current } = props;
  const duration = current === undefined ? null : flowDurationSeconds(current);
  return (
    <>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={COLORS.ink} strokeWidth={STROKE} />
      {duration !== null && current !== undefined && (
        <line
          className="flow"
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          stroke={COLORS.flow}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="0.1 11.9"
          style={{
            animationDuration: `${duration}s`,
            animationDirection: current >= 0 ? 'normal' : 'reverse',
          }}
        />
      )}
    </>
  );
}

/** 在局部座標（沿 x 軸，從 0 到 length）畫元件符號 */
function Symbol({ element, length }: { element: CircuitElement; length: number }) {
  const c = length / 2;
  const lead = (from: number, to: number) => (
    <line x1={from} y1={0} x2={to} y2={0} stroke={COLORS.ink} strokeWidth={STROKE} />
  );
  switch (element.kind) {
    case 'resistor':
      return (
        <polyline
          points={`0,0 ${c - 12},0 ${c - 10},-6 ${c - 6},6 ${c - 2},-6 ${c + 2},6 ${c + 6},-6 ${c + 10},6 ${c + 12},0 ${length},0`}
          fill="none"
          stroke={COLORS.ink}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      );
    case 'battery':
      return (
        <>
          {lead(0, c - 3)}
          {lead(c + 3, length)}
          {/* a 端（負極）短粗線、b 端（正極）長細線 */}
          <line x1={c - 3} y1={-6} x2={c - 3} y2={6} stroke={COLORS.ink} strokeWidth={4} />
          <line x1={c + 3} y1={-12} x2={c + 3} y2={12} stroke={COLORS.ink} strokeWidth={STROKE} />
          <text
            x={c + 10}
            y={-8}
            fontSize={12}
            fontWeight={700}
            fill={COLORS.positive}
            textAnchor="middle"
          >
            +
          </text>
        </>
      );
    case 'switch': {
      const closed = element.closed;
      return (
        <>
          {lead(0, c - 10)}
          {lead(c + 10, length)}
          <circle cx={c - 10} cy={0} r={2.5} fill={COLORS.ink} />
          <circle cx={c + 10} cy={0} r={2.5} fill={COLORS.ink} />
          <line
            x1={c - 10}
            y1={0}
            x2={closed ? c + 10 : c + 7}
            y2={closed ? 0 : -11}
            stroke={COLORS.ink}
            strokeWidth={STROKE + 0.5}
            strokeLinecap="round"
          />
        </>
      );
    }
    case 'bulb':
    case 'ammeter':
    case 'voltmeter':
      // 圓形本體畫在 CenterDecoration（不旋轉，文字才會正立）
      return (
        <>
          {lead(0, c - 10)}
          {lead(c + 10, length)}
        </>
      );
    case 'wire':
      return null;
  }
}

/** 燈泡、電錶的圓形本體與讀數，不跟著旋轉 */
function CenterDecoration(props: {
  element: CircuitElement;
  result: ElementResult | null | undefined;
  x: number;
  y: number;
}) {
  const { element, result, x, y } = props;
  if (element.kind === 'bulb') {
    const b = result ? bulbBrightness(result.power) : 0;
    return (
      <g data-brightness={b.toFixed(3)}>
        {b > 0 && (
          <circle cx={x} cy={y} r={11 + 24 * b} fill={COLORS.bulbOn} opacity={0.15 + 0.55 * b} />
        )}
        <circle
          cx={x}
          cy={y}
          r={10}
          fill={b > 0 ? mixColor(COLORS.bulbDim, COLORS.bulbOn, b) : COLORS.bulbOff}
          stroke={COLORS.ink}
          strokeWidth={STROKE}
        />
        <path
          d={`M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`}
          stroke={COLORS.ink}
          strokeWidth={1.5}
        />
      </g>
    );
  }
  if (element.kind === 'ammeter' || element.kind === 'voltmeter') {
    const isAmmeter = element.kind === 'ammeter';
    const reading = result ? (isAmmeter ? result.current : result.voltage) : Number.NaN;
    return (
      <g>
        <circle cx={x} cy={y} r={11} fill="#ffffff" stroke={COLORS.ink} strokeWidth={STROKE} />
        <text
          x={x}
          y={y + 4.5}
          fontSize={13}
          fontWeight={700}
          textAnchor="middle"
          fill={COLORS.ink}
        >
          {isAmmeter ? 'A' : 'V'}
        </text>
        <MeterReading
          x={x}
          y={y}
          text={`${formatNumber(Math.abs(reading))} ${isAmmeter ? 'A' : 'V'}`}
        />
      </g>
    );
  }
  return null;
}

/** 兩個 #rrggbb 色碼之間的線性插值 */
function mixColor(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t),
  );
  return `rgb(${mixed.join(' ')})`;
}

function MeterReading({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g data-reading={text}>
      <rect x={x - 33} y={y + 13} width={66} height={16} rx={3} fill="#111827" />
      <text
        x={x}
        y={y + 25.5}
        fontSize={12}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
        fill="#86efac"
      >
        {text}
      </text>
    </g>
  );
}

/** 元件參數（電阻值、電動勢）標在結果標籤的另一側 */
function ParameterTag(props: {
  element: CircuitElement;
  x: number;
  y: number;
  horizontal: boolean;
}) {
  const { element, x, y, horizontal } = props;
  let text: string | null = null;
  if (element.kind === 'resistor' || element.kind === 'bulb') {
    text = formatParameter(element.resistance, 'Ω');
  } else if (element.kind === 'battery') {
    text =
      formatParameter(element.emf, 'V') +
      (element.internalR > 0 ? ` r=${formatParameter(element.internalR, 'Ω')}` : '');
  }
  if (!text) return null;
  const offset = element.kind === 'bulb' ? 16 : 13;
  return (
    <text
      x={horizontal ? x : x - offset}
      y={horizontal ? y + offset + 10 : y + 4}
      fontSize={11.5}
      textAnchor={horizontal ? 'middle' : 'end'}
      fill={COLORS.muted}
    >
      {text}
    </text>
  );
}

function arrowFor(element: CircuitElement, current: number): string {
  if (Math.abs(current) < 1e-9) return '';
  const sign = current > 0 ? 1 : -1;
  const dx = (element.b.x - element.a.x) * sign;
  const dy = (element.b.y - element.a.y) * sign;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? '→' : '←';
  return dy > 0 ? '↓' : '↑';
}

/** 電流（含方向）、兩端電壓與功率 */
function ResultLabel(props: {
  element: CircuitElement;
  result: ElementResult | null | undefined;
  x: number;
  y: number;
  horizontal: boolean;
}) {
  const { element, result, x, y, horizontal } = props;
  if (element.kind === 'ammeter' || element.kind === 'voltmeter') return null;
  let lines: ReactNode[];
  if (!result) {
    lines = ['I —', 'V —', 'P —'];
  } else {
    // 電池顯示輸出功率（供電為正），其他元件顯示消耗功率
    const power = element.kind === 'battery' ? -result.power : result.power;
    lines = [
      `${arrowFor(element, result.current)} ${formatNumber(Math.abs(result.current))} A`,
      `${formatNumber(Math.abs(result.voltage))} V`,
      `${formatNumber(power)} W`,
    ];
  }
  const lineHeight = 12;
  const top = horizontal ? y - 18 - lineHeight * 2 : y - lineHeight + 4;
  const left = horizontal ? x : x + (element.kind === 'bulb' ? 15 : 12);
  return (
    <text
      x={left}
      y={top}
      fontSize={11}
      fontFamily="ui-monospace, monospace"
      textAnchor={horizontal ? 'middle' : 'start'}
      fill={COLORS.ink}
      stroke={COLORS.labelBg}
      strokeWidth={3}
      paintOrder="stroke"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={left} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function sameResult(p: ElementResult | null | undefined, q: ElementResult | null | undefined) {
  if (p === q) return true;
  if (!p || !q) return false;
  return p.current === q.current && p.voltage === q.voltage && p.power === q.power;
}

/** 每次求解都會產生新的結果物件，因此以數值比較，只有結果真的改變才重繪 */
export const ElementView = memo(
  ElementViewImpl,
  (prev, next) =>
    prev.element === next.element &&
    prev.selected === next.selected &&
    prev.highlight === next.highlight &&
    prev.showLabels === next.showLabels &&
    sameResult(prev.result, next.result),
);
