import { describe, expect, it } from 'vitest';
import { solveLinearSystem } from './linalg';

function residual(A: number[][], x: number[], b: number[]): number {
  let max = 0;
  A.forEach((row, i) => {
    const sum = row.reduce((acc, aij, j) => acc + aij * (x[j] ?? 0), 0);
    max = Math.max(max, Math.abs(sum - (b[i] ?? 0)));
  });
  return max;
}

describe('solveLinearSystem', () => {
  it('解出 2×2 已知解', () => {
    const result = solveLinearSystem(
      [
        [2, 1],
        [1, 3],
      ],
      [3, 5],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x[0]).toBeCloseTo(0.8, 12);
    expect(result.x[1]).toBeCloseTo(1.4, 12);
  });

  it('對角線為 0 時靠換列仍能求解（理想電壓源的 MNA 列）', () => {
    const result = solveLinearSystem(
      [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ],
      [5, 4, 3],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.x).toEqual([expect.closeTo(1, 12), expect.closeTo(2, 12), expect.closeTo(3, 12)]);
  });

  it('偵測奇異矩陣而不是回傳 NaN 或 Infinity', () => {
    const result = solveLinearSystem(
      [
        [1, 2],
        [2, 4],
      ],
      [1, 2],
    );
    expect(result.ok).toBe(false);
  });

  it('全為 0 的矩陣視為奇異', () => {
    expect(solveLinearSystem([[0]], [1]).ok).toBe(false);
  });

  it('空系統回傳空解', () => {
    expect(solveLinearSystem([], [])).toEqual({ ok: true, x: [] });
  });

  it('不修改傳入的矩陣與向量', () => {
    const A = [
      [4, 1],
      [2, 3],
    ];
    const b = [1, 2];
    solveLinearSystem(A, b);
    expect(A).toEqual([
      [4, 1],
      [2, 3],
    ]);
    expect(b).toEqual([1, 2]);
  });

  it('數值範圍相差很大時（1 MΩ 與 0.01 Ω 並存）殘差仍很小', () => {
    const g1 = 1e-6;
    const g2 = 100;
    const A = [
      [g1 + g2, -g2, 1],
      [-g2, g2 + 1, 0],
      [1, 0, 0],
    ];
    const b = [0, 0, 12];
    const result = solveLinearSystem(A, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(residual(A, result.x, b)).toBeLessThan(1e-9);
  });

  it('隨機 50×50 對角優勢矩陣殘差小於 1e-9', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32 - 0.5;
    };
    const n = 50;
    const A = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? n + rand() : rand())),
    );
    const b = Array.from({ length: n }, rand);
    const result = solveLinearSystem(A, b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(residual(A, result.x, b)).toBeLessThan(1e-9);
  });
});
