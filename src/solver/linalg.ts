export type LinearSolveResult = { ok: true; x: number[] } | { ok: false; reason: 'singular' };

/** 樞軸絕對值低於「矩陣最大元素 × 此比例」即視為奇異。 */
const SINGULAR_RELATIVE_TOLERANCE = 1e-13;

/**
 * 以含部分樞軸的高斯消去法解 A·x = b。
 * 不修改輸入；遇到奇異矩陣回傳 { ok: false }，絕不產生 NaN 或 Infinity。
 */
export function solveLinearSystem(
  A: readonly (readonly number[])[],
  b: readonly number[],
): LinearSolveResult {
  const n = b.length;
  if (n === 0) return { ok: true, x: [] };

  // 以一維陣列儲存增廣矩陣 [A | b]，每列 n + 1 個元素
  const width = n + 1;
  const m = new Float64Array(n * width);
  let scale = 0;
  for (let i = 0; i < n; i++) {
    const row = A[i];
    if (!row || row.length !== n) throw new Error(`矩陣第 ${i} 列長度應為 ${n}`);
    for (let j = 0; j < n; j++) {
      const value = row[j] as number;
      m[i * width + j] = value;
      scale = Math.max(scale, Math.abs(value));
    }
    m[i * width + n] = b[i] as number;
  }
  if (scale === 0) return { ok: false, reason: 'singular' };
  const tolerance = scale * SINGULAR_RELATIVE_TOLERANCE;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotAbs = Math.abs(m[col * width + col] as number);
    for (let r = col + 1; r < n; r++) {
      const candidate = Math.abs(m[r * width + col] as number);
      if (candidate > pivotAbs) {
        pivotAbs = candidate;
        pivotRow = r;
      }
    }
    if (pivotAbs <= tolerance) return { ok: false, reason: 'singular' };

    if (pivotRow !== col) {
      for (let j = col; j < width; j++) {
        const tmp = m[col * width + j] as number;
        m[col * width + j] = m[pivotRow * width + j] as number;
        m[pivotRow * width + j] = tmp;
      }
    }

    const pivot = m[col * width + col] as number;
    for (let r = col + 1; r < n; r++) {
      const factor = (m[r * width + col] as number) / pivot;
      if (factor === 0) continue;
      for (let j = col; j < width; j++) {
        m[r * width + j] = (m[r * width + j] as number) - factor * (m[col * width + j] as number);
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = m[i * width + n] as number;
    for (let j = i + 1; j < n; j++) sum -= (m[i * width + j] as number) * (x[j] as number);
    x[i] = sum / (m[i * width + i] as number);
  }

  if (!x.every(Number.isFinite)) return { ok: false, reason: 'singular' };
  return { ok: true, x };
}
