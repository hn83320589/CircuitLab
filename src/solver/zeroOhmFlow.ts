import { solveLinearSystem } from './linalg';

export interface ZeroOhmEdge {
  readonly pa: number;
  readonly pb: number;
}

/**
 * 在一個超節點內部分配 0 Ω 元件的電流。
 *
 * injection(p) 是格點 p 流向「非 0 Ω 元件」的電流總和。我們要找出每條邊的電流 f（a → b），
 * 使每個格點滿足 KCL：Σ(流出的 f) + injection = 0。
 * 有迴路時解不唯一，因此假設每條 0 Ω 邊電阻相同，解 Laplacian L·φ = −injection，
 * 取 f = φa − φb，也就是最小能量的分配（並聯導線平分電流）。
 *
 * points 必須是同一個超節點內（由 edges 連通）的格點；回傳與 edges 對齊的電流，失敗時回傳 null。
 */
export function distributeZeroOhmCurrents(
  points: readonly number[],
  edges: readonly ZeroOhmEdge[],
  injection: (point: number) => number,
): number[] | null {
  if (edges.length === 0) return [];
  const local = new Map<number, number>();
  points.forEach((p, i) => local.set(p, i));
  const localOf = (p: number) => {
    const i = local.get(p);
    if (i === undefined) throw new Error(`格點 ${p} 不在此超節點內`);
    return i;
  };

  const rhs = points.map((p) => -injection(p));
  if (rhs.every((v) => v === 0)) return edges.map(() => 0);

  // 以第一個格點為參考（φ = 0），刪去其方程式
  const size = points.length - 1;
  const L = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const add = (row: number, col: number, value: number) => {
    if (row < 1 || col < 1) return;
    (L[row - 1] as number[])[col - 1] = ((L[row - 1] as number[])[col - 1] as number) + value;
  };
  for (const edge of edges) {
    const i = localOf(edge.pa);
    const j = localOf(edge.pb);
    add(i, i, 1);
    add(j, j, 1);
    add(i, j, -1);
    add(j, i, -1);
  }

  const solution = solveLinearSystem(L, rhs.slice(1));
  if (!solution.ok) return null;
  const phi = [0, ...solution.x];
  return edges.map((e) => (phi[localOf(e.pa)] as number) - (phi[localOf(e.pb)] as number));
}
