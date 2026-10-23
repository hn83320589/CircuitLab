import type { Circuit, CircuitElement, ElementKind, Point } from './types';

export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 40;
/** 導線以外的元件固定佔 2 格，以中點旋轉後端點仍在格點上 */
export const ELEMENT_LENGTH = 2;

export type ValueField = 'resistance' | 'emf' | 'internalR';

export const VALUE_RANGES: Record<ValueField, { min: number; max: number; unit: string }> = {
  resistance: { min: 0.01, max: 1_000_000, unit: 'Ω' },
  emf: { min: 0, max: 1000, unit: 'V' },
  internalR: { min: 0, max: 1000, unit: 'Ω' },
};

export const KIND_LABELS: Record<ElementKind, string> = {
  battery: '電池',
  resistor: '電阻',
  bulb: '燈泡',
  switch: '開關',
  wire: '導線',
  ammeter: '電流計',
  voltmeter: '電壓計',
};

export function isValidValue(field: ValueField, value: number): boolean {
  const { min, max } = VALUE_RANGES[field];
  return Number.isFinite(value) && value >= min && value <= max;
}

export function isInsideGrid(p: Point): boolean {
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= 0 &&
    p.x <= GRID_WIDTH &&
    p.y >= 0 &&
    p.y <= GRID_HEIGHT
  );
}

/** 以 center 為中點建立水平放置的元件。 */
export function createElement(
  kind: Exclude<ElementKind, 'wire'>,
  id: string,
  center: Point,
): CircuitElement {
  const half = ELEMENT_LENGTH / 2;
  const a = { x: center.x - half, y: center.y };
  const b = { x: center.x + half, y: center.y };
  switch (kind) {
    case 'battery':
      return { kind, id, a, b, emf: 6, internalR: 0 };
    case 'resistor':
      return { kind, id, a, b, resistance: 10 };
    case 'bulb':
      return { kind, id, a, b, resistance: 10 };
    case 'switch':
      return { kind, id, a, b, closed: true };
    default:
      return { kind, id, a, b };
  }
}

/** 下一個可用的元件 id（e1、e2…），id 越短，分享連結越短。 */
export function nextElementId(circuit: Circuit): string {
  let max = 0;
  for (const el of circuit.elements) {
    const match = /^e(\d+)$/.exec(el.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `e${max + 1}`;
}

export function translate<T extends CircuitElement>(el: T, dx: number, dy: number): T {
  return {
    ...el,
    a: { x: el.a.x + dx, y: el.a.y + dy },
    b: { x: el.b.x + dx, y: el.b.y + dy },
  };
}

/** 以中點（四捨五入到格點）為軸順時針旋轉 90°。 */
export function rotate90<T extends CircuitElement>(el: T): T {
  const cx = Math.round((el.a.x + el.b.x) / 2);
  const cy = Math.round((el.a.y + el.b.y) / 2);
  const turn = (p: Point): Point => ({ x: cx - (p.y - cy), y: cy + (p.x - cx) });
  return { ...el, a: turn(el.a), b: turn(el.b) };
}
