import { describe, expect, it } from 'vitest';
import { formatNumber, formatParameter } from './format';

describe('formatNumber', () => {
  it('固定顯示 3 位小數', () => {
    expect(formatNumber(1)).toBe('1.000');
    expect(formatNumber(0.12345)).toBe('0.123');
    expect(formatNumber(-0.0001)).toBe('0.000');
  });

  it('NaN 與 Infinity 一律顯示破折號', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('—');
  });
});

describe('formatParameter', () => {
  it('以 k、M 前綴精簡顯示元件參數', () => {
    expect(formatParameter(10, 'Ω')).toBe('10 Ω');
    expect(formatParameter(0.5, 'Ω')).toBe('0.5 Ω');
    expect(formatParameter(4700, 'Ω')).toBe('4.7 kΩ');
    expect(formatParameter(1_000_000, 'Ω')).toBe('1 MΩ');
    expect(formatParameter(Number.NaN, 'V')).toBe('—');
  });
});
