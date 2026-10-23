/** 所有顯示用數字的唯一出口：固定 3 位小數，非有限值一律顯示「—」。 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(3);
  // 避免顯示 "-0.000"
  return fixed === '-0.000' ? '0.000' : fixed;
}
