import { describe, expect, it } from 'vitest';
import { solve, type ElementResult, type SolveResult } from './solve';
import { layoutNetlist } from './testing/layout';

/** 驗收標準：與手算值相對誤差小於 0.1%。 */
const MAX_RELATIVE_ERROR = 1e-3;

function resultOf(result: SolveResult, id: string): ElementResult {
  const r = result.elements.get(id);
  if (!r) throw new Error(`元件 ${id} 沒有求解結果`);
  return r;
}

function expectClose(actual: number, expected: number) {
  const relative = Math.abs(actual - expected) / Math.abs(expected);
  expect(relative, `actual=${actual}, expected=${expected}`).toBeLessThan(MAX_RELATIVE_ERROR);
}

describe('教科書電路', () => {
  it('12 V 電池串聯 4 Ω 與 8 Ω：I = 1 A，分壓 4 V 與 8 V', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 12 },
        { id: 'R4', kind: 'resistor', n1: 1, n2: 2, resistance: 4 },
        { id: 'R8', kind: 'resistor', n1: 2, n2: 0, resistance: 8 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expectClose(resultOf(result, 'E').current, 1);
    expectClose(resultOf(result, 'R4').current, 1);
    expectClose(resultOf(result, 'R4').voltage, 4);
    expectClose(resultOf(result, 'R8').voltage, 8);
    expectClose(resultOf(result, 'R4').power, 4);
    expectClose(resultOf(result, 'R8').power, 8);
  });

  it('6 V 電池接 3 Ω 與 6 Ω 並聯：總電流 3 A，支路 2 A 與 1 A', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 6 },
        { id: 'R3', kind: 'resistor', n1: 1, n2: 0, resistance: 3 },
        { id: 'R6', kind: 'resistor', n1: 1, n2: 0, resistance: 6 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expectClose(resultOf(result, 'E').current, 3);
    expectClose(resultOf(result, 'R3').current, 2);
    expectClose(resultOf(result, 'R6').current, 1);
    expectClose(resultOf(result, 'R3').voltage, 6);
    expectClose(resultOf(result, 'R6').voltage, 6);
  });

  // 節點：1 = 電池正極 A，0 = 電池負極 B，2 = C，3 = D；R5 跨接 C、D
  const bridge = (r1: number, r2: number, r3: number, r4: number) =>
    layoutNetlist([
      { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 10 },
      { id: 'R1', kind: 'resistor', n1: 1, n2: 2, resistance: r1 },
      { id: 'R2', kind: 'resistor', n1: 2, n2: 0, resistance: r2 },
      { id: 'R3', kind: 'resistor', n1: 1, n2: 3, resistance: r3 },
      { id: 'R4', kind: 'resistor', n1: 3, n2: 0, resistance: r4 },
      { id: 'R5', kind: 'resistor', n1: 2, n2: 3, resistance: 50 },
    ]);

  it('惠斯登電橋（平衡）：橋臂電流為 0', () => {
    const result = solve(bridge(100, 200, 150, 300));
    expect(result.diagnostics).toEqual([]);
    expect(Math.abs(resultOf(result, 'R5').current)).toBeLessThan(1e-12);
    expectClose(resultOf(result, 'R1').current, 10 / 300);
    expectClose(resultOf(result, 'R3').current, 10 / 450);
    expectClose(resultOf(result, 'E').current, 10 / 300 + 10 / 450);
  });

  it('惠斯登電橋（不平衡）：與節點電壓法手算值相符', () => {
    // 手算：7C − 4D = 20，−4C + 7D = 10 ⇒ C = 180/33 V，D = 150/33 V
    const result = solve(bridge(100, 200, 200, 100));
    expect(result.diagnostics).toEqual([]);
    expectClose(resultOf(result, 'R5').current, 0.6 / 33);
    expectClose(resultOf(result, 'R5').voltage, 30 / 33);
    expectClose(resultOf(result, 'R2').voltage, 180 / 33);
    expectClose(resultOf(result, 'R4').voltage, 150 / 33);
    expectClose(resultOf(result, 'E').current, 2.4 / 33);
  });

  it('9 V、內電阻 1 Ω 的電池接 8 Ω 負載：端電壓 8 V', () => {
    const result = solve(
      layoutNetlist([
        { id: 'E', kind: 'battery', n1: 0, n2: 1, emf: 9, internalR: 1 },
        { id: 'RL', kind: 'resistor', n1: 1, n2: 0, resistance: 8 },
      ]),
    );
    expect(result.diagnostics).toEqual([]);
    expectClose(resultOf(result, 'E').current, 1);
    // 電池 b 端為正極，電壓定義為 V(a) − V(b)，所以端電壓為 −8 V
    expectClose(resultOf(result, 'E').voltage, -8);
    expectClose(resultOf(result, 'RL').voltage, 8);
    // 電池吸收功率 = I²r − E·I = 1 − 9 = −8 W（負值代表供應）
    expectClose(resultOf(result, 'E').power, -8);
  });
});
