import { describe, expect, it } from 'vitest';
import type { Circuit } from '../model/types';
import { CircuitBuilder } from './builder';
import {
  evaluatePrediction,
  judgeChange,
  predictionReducer,
  type PredictionState,
} from './prediction';

describe('judgeChange', () => {
  it('依功率變化判斷變亮、變暗、不變', () => {
    expect(judgeChange(1, 2)).toBe('brighter');
    expect(judgeChange(2, 1)).toBe('dimmer');
    expect(judgeChange(2, 2)).toBe('same');
    expect(judgeChange(0, 0)).toBe('same');
  });

  it('浮點誤差等級的差異視為不變', () => {
    expect(judgeChange(3.6, 3.6 + 1e-12)).toBe('same');
    expect(judgeChange(0, 1e-12)).toBe('same');
  });
});

/** 電池 → 燈泡 L1，L2 經開關與 L1 並聯 */
function parallelBranch(internalR: number): Circuit {
  return new CircuitBuilder()
    .battery(8, 16, 'up', 6, internalR) // e1
    .wire([8, 15], [8, 10], [18, 10]) // e2 e3
    .bulb(18, 14, 'down', 10) // e4 = L1
    .wire([18, 10], [18, 13]) // e5
    .wire([18, 15], [18, 20]) // e6
    .wire([18, 10], [28, 10], [28, 11]) // e7 e8
    .switch(28, 12, 'down', false) // e9
    .wire([28, 13], [28, 15]) // e10
    .bulb(28, 16, 'down', 10) // e11 = L2
    .wire([28, 17], [28, 20], [18, 20], [8, 20], [8, 17])
    .build();
}

describe('evaluatePrediction', () => {
  it('理想電池：閉合並聯支路的開關，原本的燈泡亮度不變', () => {
    const outcome = evaluatePrediction(parallelBranch(0), 'e4', 'e9', 'same');
    expect(outcome).toMatchObject({ ok: true, actual: 'same', correct: true });
  });

  it('有內電阻：閉合並聯支路的開關，原本的燈泡變暗', () => {
    const outcome = evaluatePrediction(parallelBranch(1), 'e4', 'e9', 'brighter');
    expect(outcome).toMatchObject({ ok: true, actual: 'dimmer', correct: false });
    if (!outcome.ok) return;
    expect(outcome.before).toBeCloseTo((6 / 11) ** 2 * 10, 9);
    expect(outcome.after).toBeCloseTo(2.5, 9);
  });

  it('被開關接上的燈泡由暗變亮', () => {
    const outcome = evaluatePrediction(parallelBranch(1), 'e11', 'e9', 'brighter');
    expect(outcome).toMatchObject({ ok: true, actual: 'brighter', correct: true });
  });

  it('切換後電路有錯誤接法時，回報無法判斷', () => {
    // 開關直接跨接理想電池兩端
    const circuit = new CircuitBuilder()
      .battery(8, 16, 'up', 6) // e1
      .wire([8, 15], [8, 10], [18, 10]) // e2 e3
      .bulb(18, 14, 'down', 10) // e4
      .wire([18, 10], [18, 13]) // e5
      .wire([18, 15], [18, 20]) // e6
      .wire([18, 10], [26, 10], [26, 13]) // e7 e8
      .switch(26, 14, 'down', false) // e9
      .wire([26, 15], [26, 20], [18, 20], [8, 20], [8, 17])
      .build();
    const outcome = evaluatePrediction(circuit, 'e4', 'e9', 'dimmer');
    expect(outcome.ok).toBe(false);
  });
});

describe('predictionReducer', () => {
  it('依序選擇燈泡、開關，猜測後顯示結果，可以再預測一次', () => {
    let s: PredictionState = { step: 'off' };
    s = predictionReducer(s, { type: 'start' });
    expect(s.step).toBe('pickBulb');
    s = predictionReducer(s, { type: 'pickBulb', id: 'L1' });
    expect(s).toEqual({ step: 'pickSwitch', bulbId: 'L1' });
    s = predictionReducer(s, { type: 'pickSwitch', id: 'S1' });
    s = predictionReducer(s, { type: 'guess', guess: 'dimmer' });
    expect(s).toMatchObject({ step: 'guess', guess: 'dimmer' });
    const outcome = {
      ok: true as const,
      before: 2,
      after: 1,
      actual: 'dimmer' as const,
      correct: true,
    };
    s = predictionReducer(s, { type: 'reveal', outcome });
    expect(s).toMatchObject({ step: 'result', outcome });
    s = predictionReducer(s, { type: 'again' });
    expect(s).toEqual({ step: 'guess', bulbId: 'L1', switchId: 'S1', guess: null });
    expect(predictionReducer(s, { type: 'stop' })).toEqual({ step: 'off' });
  });

  it('還沒猜測不能揭曉結果', () => {
    const s: PredictionState = { step: 'guess', bulbId: 'L1', switchId: 'S1', guess: null };
    const outcome = {
      ok: true as const,
      before: 2,
      after: 1,
      actual: 'dimmer' as const,
      correct: true,
    };
    expect(predictionReducer(s, { type: 'reveal', outcome })).toBe(s);
  });
});
