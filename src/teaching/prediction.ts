import type { Circuit } from '../model/types';
import { solve } from '../solver/solve';

export type Change = 'brighter' | 'dimmer' | 'same';

export const CHANGE_LABELS: Record<Change, string> = {
  brighter: '變亮',
  dimmer: '變暗',
  same: '不變',
};

/** 功率差小於此絕對值（W）或相對比例，視為不變 */
const SAME_ABSOLUTE_W = 1e-9;
const SAME_RELATIVE = 1e-6;

export function judgeChange(before: number, after: number): Change {
  const tolerance = Math.max(SAME_ABSOLUTE_W, SAME_RELATIVE * Math.max(before, after));
  if (Math.abs(after - before) <= tolerance) return 'same';
  return after > before ? 'brighter' : 'dimmer';
}

export type PredictionOutcome =
  | { ok: true; before: number; after: number; actual: Change; correct: boolean }
  | { ok: false; reason: string };

function bulbPower(circuit: Circuit, bulbId: string): number | null {
  const result = solve(circuit);
  const hasError = result.diagnostics.some((d) => d.severity === 'error');
  const r = result.elements.get(bulbId);
  return hasError || !r ? null : r.power;
}

/** 計算切換開關前後的燈泡功率，判斷學生的預測是否正確。 */
export function evaluatePrediction(
  circuit: Circuit,
  bulbId: string,
  switchId: string,
  guess: Change,
): PredictionOutcome {
  const toggled: Circuit = {
    ...circuit,
    elements: circuit.elements.map((el) =>
      el.id === switchId && el.kind === 'switch' ? { ...el, closed: !el.closed } : el,
    ),
  };
  const before = bulbPower(circuit, bulbId);
  const after = bulbPower(toggled, bulbId);
  if (before === null || after === null) {
    return { ok: false, reason: '這個電路有錯誤接法，無法判斷燈泡亮度的變化。' };
  }
  const actual = judgeChange(before, after);
  return { ok: true, before, after, actual, correct: actual === guess };
}

export type PredictionState =
  | { step: 'off' }
  | { step: 'pickBulb' }
  | { step: 'pickSwitch'; bulbId: string }
  | { step: 'guess'; bulbId: string; switchId: string; guess: Change | null }
  | { step: 'result'; bulbId: string; switchId: string; guess: Change; outcome: PredictionOutcome };

export type PredictionAction =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'pickBulb'; id: string }
  | { type: 'pickSwitch'; id: string }
  | { type: 'guess'; guess: Change }
  | { type: 'reveal'; outcome: PredictionOutcome }
  | { type: 'again' };

export function predictionReducer(
  state: PredictionState,
  action: PredictionAction,
): PredictionState {
  switch (action.type) {
    case 'start':
      return { step: 'pickBulb' };
    case 'stop':
      return { step: 'off' };
    case 'pickBulb':
      return state.step === 'pickBulb' ? { step: 'pickSwitch', bulbId: action.id } : state;
    case 'pickSwitch':
      return state.step === 'pickSwitch'
        ? { step: 'guess', bulbId: state.bulbId, switchId: action.id, guess: null }
        : state;
    case 'guess':
      return state.step === 'guess' ? { ...state, guess: action.guess } : state;
    case 'reveal':
      return state.step === 'guess' && state.guess
        ? { ...state, step: 'result', guess: state.guess, outcome: action.outcome }
        : state;
    case 'again':
      return state.step === 'result'
        ? { step: 'guess', bulbId: state.bulbId, switchId: state.switchId, guess: null }
        : state;
  }
}
