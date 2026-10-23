import { describe, expect, it } from 'vitest';
import type { Circuit, CircuitElement, ElementKind } from '../model/types';
import { solve, type SolveResult } from '../solver/solve';
import { allFinite, maxKclResidual } from '../solver/testing/invariants';
import { EXAMPLES } from './examples';

function example(id: string): Circuit {
  const found = EXAMPLES.find((e) => e.id === id);
  if (!found) throw new Error(`找不到範例 ${id}`);
  return found.circuit;
}

/** 依出現順序取得第 n 個指定種類的元件 */
function nth(circuit: Circuit, kind: ElementKind, n = 0): CircuitElement {
  const el = circuit.elements.filter((e) => e.kind === kind)[n];
  if (!el) throw new Error(`找不到第 ${n} 個 ${kind}`);
  return el;
}

function value(result: SolveResult, el: CircuitElement, field: 'current' | 'voltage' | 'power') {
  const r = result.elements.get(el.id);
  if (!r) throw new Error(`${el.id} 沒有數值`);
  return Math.abs(r[field]);
}

function toggleFirstSwitch(circuit: Circuit): Circuit {
  const sw = nth(circuit, 'switch');
  return {
    ...circuit,
    elements: circuit.elements.map((el) =>
      el.id === sw.id && el.kind === 'switch' ? { ...el, closed: !el.closed } : el,
    ),
  };
}

describe('內建範例', () => {
  it('至少 8 個，id 不重複', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  it.each(EXAMPLES.map((e) => [e.title, e] as const))(
    '%s：可以求解、沒有任何問題提示、滿足 KCL、元件都在畫布內',
    (_, ex) => {
      const result = solve(ex.circuit);
      expect(result.diagnostics).toEqual([]);
      expect(allFinite(result)).toBe(true);
      expect(maxKclResidual(ex.circuit, result)).toBeLessThan(1e-9);
      for (const el of ex.circuit.elements) {
        for (const p of [el.a, el.b]) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(60);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(40);
        }
      }
    },
  );

  it('串聯：I = 1 A，分壓 4 V、8 V', () => {
    const c = example('series');
    const r = solve(c);
    expect(value(r, nth(c, 'resistor', 0), 'voltage')).toBeCloseTo(4, 9);
    expect(value(r, nth(c, 'resistor', 1), 'voltage')).toBeCloseTo(8, 9);
    expect(value(r, nth(c, 'battery'), 'current')).toBeCloseTo(1, 9);
  });

  it('並聯：電流計讀 3 A，支路 2 A 與 1 A', () => {
    const c = example('parallel');
    const r = solve(c);
    expect(value(r, nth(c, 'ammeter'), 'current')).toBeCloseTo(3, 9);
    expect(value(r, nth(c, 'resistor', 0), 'current')).toBeCloseTo(2, 9);
    expect(value(r, nth(c, 'resistor', 1), 'current')).toBeCloseTo(1, 9);
  });

  it('串並聯混合：總電流 1.5 A，6 Ω 支路 1 A、12 Ω 支路 0.5 A', () => {
    const c = example('mixed');
    const r = solve(c);
    expect(value(r, nth(c, 'battery'), 'current')).toBeCloseTo(1.5, 9);
    expect(value(r, nth(c, 'resistor', 1), 'current')).toBeCloseTo(1, 9);
    expect(value(r, nth(c, 'resistor', 2), 'current')).toBeCloseTo(0.5, 9);
  });

  it('惠斯登電橋：平衡時電流計讀 0；不平衡時讀 0.025 A', () => {
    const balanced = example('bridge-balanced');
    expect(value(solve(balanced), nth(balanced, 'ammeter'), 'current')).toBeLessThan(1e-12);
    // 電流計內阻 0：(100∥200) 串聯 (200∥100)，V_C = 5 V；I_R1 − I_R2 = 0.05 − 0.025
    const unbalanced = example('bridge-unbalanced');
    const r = solve(unbalanced);
    expect(value(r, nth(unbalanced, 'ammeter'), 'current')).toBeCloseTo(0.025, 9);
    expect(value(r, nth(unbalanced, 'battery'), 'current')).toBeCloseTo(0.075, 9);
  });

  it('內電阻：開關斷開時電壓計讀 9 V，閉合後讀 8 V', () => {
    const c = example('internal-resistance');
    expect(value(solve(c), nth(c, 'voltmeter'), 'voltage')).toBeCloseTo(9, 9);
    const closed = toggleFirstSwitch(c);
    expect(value(solve(closed), nth(closed, 'voltmeter'), 'voltage')).toBeCloseTo(8, 9);
  });

  it('串並聯對照：串聯燈泡各 0.9 W，並聯燈泡各 3.6 W', () => {
    const c = example('comparison');
    const r = solve(c);
    expect(value(r, nth(c, 'bulb', 0), 'power')).toBeCloseTo(0.9, 9);
    expect(value(r, nth(c, 'bulb', 1), 'power')).toBeCloseTo(0.9, 9);
    expect(value(r, nth(c, 'bulb', 2), 'power')).toBeCloseTo(3.6, 9);
    expect(value(r, nth(c, 'bulb', 3), 'power')).toBeCloseTo(3.6, 9);
  });

  it('電錶接法：電流計讀 0.2 A，電壓計讀燈泡電壓 4 V', () => {
    const c = example('meters');
    const r = solve(c);
    expect(value(r, nth(c, 'ammeter'), 'current')).toBeCloseTo(0.2, 9);
    expect(value(r, nth(c, 'voltmeter'), 'voltage')).toBeCloseTo(4, 9);
  });

  it('短路示範：閉合開關後標出電池短路', () => {
    const closed = toggleFirstSwitch(example('short-circuit'));
    const result = solve(closed);
    expect(result.diagnostics.map((d) => d.code)).toContain('BATTERY_SHORTED');
    expect(allFinite(result)).toBe(true);
  });
});
