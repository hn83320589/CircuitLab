/** 所有顯示用數字的唯一出口：固定 3 位小數，非有限值一律顯示「—」。 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(3);
  // 避免顯示 "-0.000"
  return fixed === '-0.000' ? '0.000' : fixed;
}

/** 元件參數的精簡顯示，例如 10 Ω、4.7 kΩ、1 MΩ、0.5 Ω。 */
export function formatParameter(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '—';
  const trim = (v: number) => String(Number(v.toPrecision(4)));
  if (Math.abs(value) >= 1e6) return `${trim(value / 1e6)} M${unit}`;
  if (Math.abs(value) >= 1e3) return `${trim(value / 1e3)} k${unit}`;
  return `${trim(value)} ${unit}`;
}
