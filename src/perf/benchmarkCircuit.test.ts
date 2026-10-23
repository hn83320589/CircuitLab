import { describe, expect, it } from 'vitest';
import { solve } from '../solver/solve';
import { maxKclResidual } from '../solver/testing/invariants';
import { benchmarkCircuit } from './benchmarkCircuit';

describe('200 個元件的基準電路', () => {
  it('恰好 200 個元件（不含導線），可以求解且沒有錯誤', () => {
    const circuit = benchmarkCircuit();
    expect(circuit.elements.filter((el) => el.kind !== 'wire')).toHaveLength(200);
    const result = solve(circuit);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(maxKclResidual(circuit, result)).toBeLessThan(1e-9);
  });
});
