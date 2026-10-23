import { solveLinearSystem } from './linalg';

export interface ResistiveBranch {
  readonly kind: 'resistive';
  readonly sa: number;
  readonly sb: number;
  readonly conductance: number;
}

/**
 * 電壓源串聯內電阻：V(sb) − V(sa) = emf − internalR · I，
 * I 為電源內部由 sa 流向 sb 的電流（從負極流向正極）。
 */
export interface SourceBranch {
  readonly kind: 'source';
  readonly sa: number;
  readonly sb: number;
  readonly emf: number;
  readonly internalR: number;
}

export type Branch = ResistiveBranch | SourceBranch;

export interface MnaProblem {
  /** 此連通分量內的超節點，第一個是接地點。 */
  readonly supernodes: readonly number[];
  readonly branches: readonly Branch[];
}

export interface MnaSolution {
  /** 與 problem.supernodes 對齊的電位 */
  readonly voltages: readonly number[];
  /** 與 problem.branches 中 source 的出現順序對齊的電流 */
  readonly sourceCurrents: readonly number[];
}

/** 建立 Modified Nodal Analysis 方程組並求解；矩陣奇異時回傳 null。 */
export function solveMna(problem: MnaProblem): MnaSolution | null {
  const { supernodes, branches } = problem;
  const nodeCount = supernodes.length - 1;
  // 超節點 → 未知數索引；接地點為 −1
  const unknownOf = new Map<number, number>();
  supernodes.forEach((s, i) => unknownOf.set(s, i - 1));
  const sourceCount = branches.filter((b) => b.kind === 'source').length;
  const size = nodeCount + sourceCount;

  const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  const add = (row: number, col: number, value: number) => {
    if (row < 0 || col < 0) return;
    (A[row] as number[])[col] = ((A[row] as number[])[col] as number) + value;
  };
  const unknown = (s: number) => {
    const index = unknownOf.get(s);
    if (index === undefined) throw new Error(`超節點 ${s} 不屬於此連通分量`);
    return index;
  };

  let k = nodeCount;
  for (const branch of branches) {
    const i = unknown(branch.sa);
    const j = unknown(branch.sb);
    if (branch.kind === 'resistive') {
      const g = branch.conductance;
      add(i, i, g);
      add(j, j, g);
      add(i, j, -g);
      add(j, i, -g);
    } else {
      // KCL：I 由 sa 流入電源、由 sb 流出
      add(i, k, 1);
      add(j, k, -1);
      // 支路方程式：V(sb) − V(sa) + r·I = emf
      add(k, j, 1);
      add(k, i, -1);
      add(k, k, branch.internalR);
      rhs[k] = branch.emf;
      k++;
    }
  }

  const solution = solveLinearSystem(A, rhs);
  if (!solution.ok) return null;
  const voltages = [0, ...solution.x.slice(0, nodeCount)];
  return { voltages, sourceCurrents: solution.x.slice(nodeCount) };
}
