import { describe, expect, it } from 'vitest';
import { bulbBrightness, flowDurationSeconds } from './visual';

describe('bulbBrightness', () => {
  it('功率越大越亮，介於 0 與 1', () => {
    expect(bulbBrightness(0)).toBe(0);
    expect(bulbBrightness(0.9)).toBeGreaterThan(0);
    expect(bulbBrightness(3.6)).toBeGreaterThan(bulbBrightness(0.9));
    expect(bulbBrightness(1000)).toBe(1);
  });

  it('非有限值或負值視為不亮', () => {
    expect(bulbBrightness(Number.NaN)).toBe(0);
    expect(bulbBrightness(Number.POSITIVE_INFINITY)).toBe(0);
    expect(bulbBrightness(-1)).toBe(0);
  });
});

describe('flowDurationSeconds', () => {
  it('沒有電流時不顯示流動點', () => {
    expect(flowDurationSeconds(0)).toBeNull();
    expect(flowDurationSeconds(1e-9)).toBeNull();
    expect(flowDurationSeconds(Number.NaN)).toBeNull();
  });

  it('電流越大流得越快，方向不影響速度', () => {
    const slow = flowDurationSeconds(0.01) as number;
    const fast = flowDurationSeconds(2) as number;
    expect(fast).toBeLessThan(slow);
    expect(flowDurationSeconds(-2)).toBe(fast);
  });
});
