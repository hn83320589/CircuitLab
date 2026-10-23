/** SVG 直接使用色碼（而非 CSS 變數），匯出 PNG 時才不會遺失樣式 */
export const COLORS = {
  ink: '#1f2937',
  muted: '#6b7280',
  grid: '#cbd5e1',
  selected: '#2563eb',
  error: '#dc2626',
  warning: '#ea580c',
  flow: '#f59e0b',
  bulbOff: '#f8fafc',
  bulbOn: '#fde047',
  labelBg: '#ffffff',
  positive: '#dc2626',
} as const;
