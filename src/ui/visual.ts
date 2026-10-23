/** 每格的像素大小（SVG 使用者座標） */
export const CELL = 20;

/** 燈泡亮度的絕對刻度：低於下限不亮，高於上限最亮 */
const BRIGHTNESS_MIN_W = 0.05;
const BRIGHTNESS_MAX_W = 20;

/**
 * 燈泡亮度（0–1），以對數絕對刻度換算。
 * 不依畫面上最亮的燈泡做正規化，兩組電路並排時亮度才能公平比較。
 */
export function bulbBrightness(power: number): number {
  if (!Number.isFinite(power) || power <= BRIGHTNESS_MIN_W) return 0;
  const t = Math.log(power / BRIGHTNESS_MIN_W) / Math.log(BRIGHTNESS_MAX_W / BRIGHTNESS_MIN_W);
  return Math.min(1, t);
}

/** 流動點虛線的週期（px），與 CSS 中的 dasharray 一致 */
export const FLOW_DASH_PERIOD = 12;
const NO_FLOW_A = 1e-6;

/** 流動點跑完一個虛線週期的秒數；電流太小時回傳 null（不顯示流動點）。 */
export function flowDurationSeconds(current: number): number | null {
  const magnitude = Math.abs(current);
  if (!Number.isFinite(magnitude) || magnitude < NO_FLOW_A) return null;
  const speed = Math.min(160, 15 + 35 * Math.log10(1 + magnitude * 100)); // px/s
  return FLOW_DASH_PERIOD / speed;
}
