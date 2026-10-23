import { describe, expect, it } from 'vitest';
import type { Circuit } from '../model/types';
import { solve, type ElementResult, type SolveResult } from './solve';
import { maxKclResidual, powerBalance } from './testing/invariants';
import { layoutNetlist, mergeCircuits, type NetSpec } from './testing/layout';

function resultOf(result: SolveResult, id: string): ElementResult {
  const r = result.elements.get(id);
  if (!r) throw new Error(`元件 ${id} 沒有求解結果`);
  return r;
}

const parallelWithAmmeter: NetSpec[] = [
  { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6 },
  { id: 'A', kind: 'ammeter', n1: 1, n2: 2 },
  { id: 'R3', kind: 'resistor', n1: 2, n2: 0, resistance: 3 },
  { id: 'R6', kind: 'resistor', n1: 1, n2: 0, resistance: 6 },
];

describe('電流計與電壓計', () => {
  it('電流計讀數等於所在支路的電流', () => {
    const result = solve(layoutNetlist(parallelWithAmmeter));
    expect(result.diagnostics).toEqual([]);
    expect(resultOf(result, 'A').current).toBeCloseTo(resultOf(result, 'R3').current, 12);
    expect(resultOf(result, 'A').current).toBeCloseTo(2, 12);
  });

  it('電壓計讀數等於兩端電位差', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 12 },
        { id: 'R4', kind: 'resistor', n1: 1, n2: 2, resistance: 4 },
        { id: 'R8', kind: 'resistor', n1: 2, n2: 0, resistance: 8 },
        { id: 'V', kind: 'voltmeter', n1: 2, n2: 0 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expect(resultOf(result, 'V').voltage).toBeCloseTo(resultOf(result, 'R8').voltage, 12);
    expect(resultOf(result, 'V').voltage).toBeCloseTo(8, 12);
    expect(resultOf(result, 'V').current).toBe(0);
  });

  it('接上電壓計不影響原電路的電流', () => {
    const base: NetSpec[] = [
      { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 10, internalR: 0.5 },
      { id: 'R1', kind: 'resistor', n1: 1, n2: 2, resistance: 100 },
      { id: 'R2', kind: 'resistor', n1: 2, n2: 0, resistance: 220 },
      { id: 'R3', kind: 'resistor', n1: 2, n2: 0, resistance: 330 },
    ];
    const without = solve(layoutNetlist(base));
    const withMeters = solve(
      layoutNetlist([
        ...base,
        { id: 'V1', kind: 'voltmeter', n1: 1, n2: 2 },
        { id: 'V2', kind: 'voltmeter', n1: 2, n2: 0 },
        { id: 'V3', kind: 'voltmeter', n1: 0, n2: 1 },
      ]),
    );
    for (const id of ['E', 'R1', 'R2', 'R3']) {
      expect(resultOf(withMeters, id).current).toBeCloseTo(resultOf(without, id).current, 12);
    }
  });
});

describe('導線與開關', () => {
  it('兩條並聯導線平分電流，且每個格點都滿足 KCL', () => {
    const circuit: Circuit = {
      version: 1,
      elements: [
        { id: 'E', kind: 'battery', a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, emf: 6, internalR: 0 },
        { id: 'R', kind: 'resistor', a: { x: 4, y: 2 }, b: { x: 4, y: 0 }, resistance: 3 },
        { id: 'w1', kind: 'wire', a: { x: 0, y: 2 }, b: { x: 4, y: 2 } },
        { id: 'w2', kind: 'wire', a: { x: 0, y: 2 }, b: { x: 4, y: 2 } },
        { id: 'w3', kind: 'wire', a: { x: 4, y: 0 }, b: { x: 0, y: 0 } },
      ],
    };
    const result = solve(circuit);
    expect(resultOf(result, 'w1').current).toBeCloseTo(1, 12);
    expect(resultOf(result, 'w2').current).toBeCloseTo(1, 12);
    expect(resultOf(result, 'w3').current).toBeCloseTo(2, 12);
    expect(maxKclResidual(circuit, result)).toBeLessThan(1e-12);
  });

  it('斷開的開關沒有電流，兩端電壓等於電動勢', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 9 },
        { id: 'S', kind: 'switch', n1: 1, n2: 2, closed: false },
        { id: 'L', kind: 'bulb', n1: 2, n2: 0, resistance: 10 },
      ]),
    );
    expect(resultOf(result, 'L').current).toBeCloseTo(0, 12);
    expect(resultOf(result, 'S').current).toBe(0);
    expect(resultOf(result, 'S').voltage).toBeCloseTo(9, 12);
  });

  it('閉合的開關視同導線', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 9 },
        { id: 'S', kind: 'switch', n1: 1, n2: 2, closed: true },
        { id: 'L', kind: 'bulb', n1: 2, n2: 0, resistance: 10 },
      ]),
    );
    expect(resultOf(result, 'S').current).toBeCloseTo(0.9, 12);
    expect(resultOf(result, 'S').voltage).toBe(0);
    expect(resultOf(result, 'L').power).toBeCloseTo(8.1, 12);
  });
});

describe('同一張畫布上兩組互不相連的電路', () => {
  const series = layoutNetlist(
    [
      { kind: 'battery', n1: 0, n2: 1, emf: 6 },
      { kind: 'bulb', n1: 1, n2: 2, resistance: 10 },
      { kind: 'bulb', n1: 2, n2: 0, resistance: 10 },
      { kind: 'ammeter', n1: 0, n2: 0 },
    ],
    { idPrefix: 's-' },
  );
  const parallel = layoutNetlist(
    [
      { kind: 'battery', n1: 0, n2: 1, emf: 6, internalR: 0.2 },
      { kind: 'bulb', n1: 1, n2: 0, resistance: 10 },
      { kind: 'bulb', n1: 1, n2: 0, resistance: 10 },
      { kind: 'voltmeter', n1: 1, n2: 0 },
    ],
    { idPrefix: 'p-', offset: { x: 30, y: 0 } },
  );

  it('合併求解的結果與分開單獨求解完全相同', () => {
    const together = solve(mergeCircuits(series, parallel));
    const alone = new Map([...solve(series).elements, ...solve(parallel).elements]);
    expect(together.elements).toEqual(alone);
  });

  it('元件順序交錯時結果仍相同', () => {
    const interleaved: Circuit = {
      version: 1,
      elements: series.elements.flatMap((el, i) => {
        const other = parallel.elements[i];
        return other ? [other, el] : [el];
      }),
    };
    const together = solve(interleaved);
    for (const [id, expected] of solve(series).elements) {
      const actual = together.elements.get(id);
      expect(actual?.current).toBeCloseTo(expected?.current ?? NaN, 12);
      expect(actual?.voltage).toBeCloseTo(expected?.voltage ?? NaN, 12);
    }
    const { supplied, consumed } = powerBalance(interleaved, together);
    expect(Math.abs(supplied - consumed) / supplied).toBeLessThan(1e-9);
  });
});
