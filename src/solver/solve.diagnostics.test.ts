import { describe, expect, it } from 'vitest';
import type { Circuit } from '../model/types';
import type { DiagnosticCode } from './diagnostics';
import { solve, type SolveResult } from './solve';
import { allFinite } from './testing/invariants';
import { layoutNetlist, mergeCircuits, type NetSpec } from './testing/layout';

function findDiagnostic(result: SolveResult, code: DiagnosticCode) {
  const found = result.diagnostics.find((d) => d.code === code);
  if (!found) {
    throw new Error(`找不到 ${code}，實際為 ${JSON.stringify(result.diagnostics)}`);
  }
  return found;
}

/** 每一種錯誤接法都必須：不拋例外、沒有 NaN/Infinity、有一句說明。 */
function expectSafe(result: SolveResult) {
  expect(allFinite(result)).toBe(true);
  for (const d of result.diagnostics) expect(d.message.length).toBeGreaterThan(5);
}

const lamp: NetSpec[] = [
  { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6 },
  { id: 'L', kind: 'bulb', n1: 1, n2: 0, resistance: 12 },
];

describe('題目指定的錯誤接法', () => {
  it('導線直接接在內電阻為 0 的電池兩端', () => {
    const result = solve(layoutNetlist([...lamp, { id: 'W', kind: 'wire', n1: 0, n2: 1 }]));
    expectSafe(result);
    const d = findDiagnostic(result, 'BATTERY_SHORTED');
    expect(d.severity).toBe('error');
    expect(d.elementIds).toEqual(expect.arrayContaining(['E', 'W']));
    expect(result.elements.get('E')).toBeNull();
    expect(result.elements.get('L')).toBeNull();
  });

  it('電流計直接並聯在電池兩端', () => {
    const result = solve(layoutNetlist([...lamp, { id: 'A', kind: 'ammeter', n1: 0, n2: 1 }]));
    expectSafe(result);
    const d = findDiagnostic(result, 'AMMETER_SHORTS_BATTERY');
    expect(d.severity).toBe('error');
    expect(d.elementIds).toEqual(expect.arrayContaining(['E', 'A']));
    expect(result.elements.get('A')).toBeNull();
  });

  it('兩個電動勢不同、內電阻為 0 的電池直接並聯', () => {
    const result = solve(
      layoutNetlist([...lamp, { id: 'E2', kind: 'battery', n1: 0, n2: 1, emf: 9 }]),
    );
    expectSafe(result);
    const d = findDiagnostic(result, 'CONFLICTING_SOURCES');
    expect(d.severity).toBe('error');
    expect(d.elementIds).toEqual(expect.arrayContaining(['E', 'E2']));
  });

  it('只接了一端、懸空的元件', () => {
    const circuit: Circuit = {
      version: 1,
      elements: [
        { id: 'E', kind: 'battery', a: { x: 0, y: 2 }, b: { x: 0, y: 0 }, emf: 6, internalR: 0 },
        { id: 'L', kind: 'bulb', a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, resistance: 12 },
        // 電阻只有 a 端接在電路上，b 端懸空
        { id: 'R', kind: 'resistor', a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, resistance: 5 },
      ],
    };
    const result = solve(circuit);
    expectSafe(result);
    const d = findDiagnostic(result, 'DANGLING');
    expect(d.severity).toBe('warning');
    expect(d.elementIds).toEqual(['R']);
    expect(result.elements.get('R')?.current).toBe(0);
    expect(result.elements.get('L')?.current).toBeCloseTo(0.5, 12);
  });

  it('電壓計串聯在電路中', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6 },
        { id: 'L', kind: 'bulb', n1: 1, n2: 2, resistance: 12 },
        { id: 'V', kind: 'voltmeter', n1: 2, n2: 0 },
      ]),
    );
    expectSafe(result);
    const d = findDiagnostic(result, 'VOLTMETER_IN_SERIES');
    expect(d.severity).toBe('warning');
    expect(d.elementIds).toEqual(['V']);
    expect(result.elements.get('L')?.current).toBeCloseTo(0, 12);
    expect(result.elements.get('V')?.voltage).toBeCloseTo(6, 12);
  });
});

describe('其他接法', () => {
  it('電動勢相同、內電阻為 0 的電池並聯：合併求解並平分電流', () => {
    const result = solve(
      layoutNetlist([...lamp, { id: 'E2', kind: 'battery', n1: 0, n2: 1, emf: 6 }]),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.elements.get('E')?.current).toBeCloseTo(0.25, 12);
    expect(result.elements.get('E2')?.current).toBeCloseTo(0.25, 12);
    expect(result.elements.get('L')?.current).toBeCloseTo(0.5, 12);
  });

  it('電池接成一圈但電動勢一致：無法決定電流', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E1', kind: 'battery', n1: 0, n2: 1, emf: 3 },
        { id: 'E2', kind: 'battery', n1: 1, n2: 2, emf: 3 },
        { id: 'E3', kind: 'battery', n1: 0, n2: 2, emf: 6 },
        { id: 'L', kind: 'bulb', n1: 2, n2: 0, resistance: 10 },
      ]),
    );
    expectSafe(result);
    const d = findDiagnostic(result, 'SOURCE_LOOP');
    expect(d.elementIds).toEqual(expect.arrayContaining(['E1', 'E2', 'E3']));
  });

  it('電池接成一圈且電動勢矛盾', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E1', kind: 'battery', n1: 0, n2: 1, emf: 3 },
        { id: 'E2', kind: 'battery', n1: 1, n2: 2, emf: 3 },
        { id: 'E3', kind: 'battery', n1: 0, n2: 2, emf: 5 },
      ]),
    );
    expectSafe(result);
    findDiagnostic(result, 'CONFLICTING_SOURCES');
  });

  it('有內電阻的電池被短路：可以計算，但提出警告', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6, internalR: 0.5 },
        { id: 'W', kind: 'wire', n1: 1, n2: 0 },
      ]),
    );
    const d = findDiagnostic(result, 'SHORT_CIRCUIT_WARNING');
    expect(d.severity).toBe('warning');
    expect(result.elements.get('E')?.current).toBeCloseTo(12, 12);
  });

  it('電壓計一端懸空：無法量測，但不影響其他元件', () => {
    const circuit: Circuit = {
      version: 1,
      elements: [
        { id: 'E', kind: 'battery', a: { x: 0, y: 2 }, b: { x: 0, y: 0 }, emf: 6, internalR: 0 },
        { id: 'L', kind: 'bulb', a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, resistance: 12 },
        { id: 'V', kind: 'voltmeter', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
      ],
    };
    const result = solve(circuit);
    expectSafe(result);
    expect(findDiagnostic(result, 'VOLTMETER_UNCONNECTED').elementIds).toEqual(['V']);
    expect(result.diagnostics.some((d) => d.code === 'DANGLING')).toBe(false);
    expect(result.elements.get('V')).toBeNull();
    expect(result.elements.get('L')?.current).toBeCloseTo(0.5, 12);
  });

  it('電壓計直接量測電池兩端（開路）不算串聯', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 1.5 },
        { id: 'V', kind: 'voltmeter', n1: 0, n2: 1 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.elements.get('V')?.voltage).toBeCloseTo(-1.5, 12);
  });

  it('電壓計量測斷開的開關兩端不算串聯', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6 },
        { id: 'S', kind: 'switch', n1: 1, n2: 2, closed: false },
        { id: 'L', kind: 'bulb', n1: 2, n2: 0, resistance: 12 },
        { id: 'V', kind: 'voltmeter', n1: 1, n2: 2 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.elements.get('V')?.voltage).toBeCloseTo(6, 12);
  });

  it('一組電路接錯，同一畫布上的另一組照常求解', () => {
    const broken = layoutNetlist([...lamp, { id: 'W', kind: 'wire', n1: 0, n2: 1 }], {
      idPrefix: 'x-',
    });
    const fine = layoutNetlist(
      [
        { id: 'E9', kind: 'battery', n1: 0, n2: 1, emf: 9 },
        { id: 'R9', kind: 'resistor', n1: 1, n2: 0, resistance: 3 },
      ],
      { offset: { x: 30, y: 0 } },
    );
    const result = solve(mergeCircuits(broken, fine));
    expectSafe(result);
    findDiagnostic(result, 'BATTERY_SHORTED');
    expect(result.elements.get('R9')?.current).toBeCloseTo(3, 12);
  });
});
