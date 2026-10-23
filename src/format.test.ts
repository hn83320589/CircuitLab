import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

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
