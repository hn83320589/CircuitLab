import { formatNumber } from '../format';
import type { Circuit } from '../model/types';
import {
  CHANGE_LABELS,
  type Change,
  type PredictionAction,
  type PredictionState,
} from '../teaching/prediction';

interface PredictionPanelProps {
  state: PredictionState;
  circuit: Circuit;
  onAction: (action: PredictionAction) => void;
  onReveal: () => void;
}

const CHOICES: Change[] = ['brighter', 'dimmer', 'same'];

export function PredictionPanel({ state, circuit, onAction, onReveal }: PredictionPanelProps) {
  if (state.step === 'off') {
    return (
      <section className="panel" aria-label="預測模式">
        <h2>預測模式</h2>
        <p className="muted">選一個燈泡與一個開關，先猜亮度怎麼變，再切換開關看結果。</p>
        <button type="button" className="primary wide" onClick={() => onAction({ type: 'start' })}>
          開始預測
        </button>
      </section>
    );
  }

  const stop = (
    <button type="button" onClick={() => onAction({ type: 'stop' })}>
      結束預測模式
    </button>
  );

  if (state.step === 'pickBulb' || state.step === 'pickSwitch') {
    return (
      <section className="panel prediction" aria-label="預測模式">
        <h2>預測模式</h2>
        <p className="instruction">
          {state.step === 'pickBulb'
            ? '步驟 1／2：請在畫布上點選要觀察的燈泡。'
            : '步驟 2／2：請在畫布上點選要切換的開關。'}
        </p>
        {stop}
      </section>
    );
  }

  const sw = circuit.elements.find((el) => el.id === state.switchId);
  const willClose = sw?.kind === 'switch' && !sw.closed;
  const action = willClose ? '閉合' : '斷開';

  if (state.step === 'guess') {
    return (
      <section className="panel prediction" aria-label="預測模式">
        <h2>預測模式</h2>
        <p className="instruction">把開關「{action}」之後，紫色框起來的燈泡會……</p>
        <div className="choices" role="radiogroup" aria-label="預測">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={state.guess === c}
              className={state.guess === c ? 'choice chosen' : 'choice'}
              onClick={() => onAction({ type: 'guess', guess: c })}
              data-choice={c}
            >
              {CHANGE_LABELS[c]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="primary wide"
          disabled={!state.guess}
          onClick={onReveal}
          data-action="reveal"
        >
          {action}開關，看結果
        </button>
        {stop}
      </section>
    );
  }

  const { outcome, guess } = state;
  return (
    <section className="panel prediction" aria-label="預測模式">
      <h2>預測模式</h2>
      {outcome.ok ? (
        <div
          className={outcome.correct ? 'verdict correct' : 'verdict wrong'}
          data-verdict={outcome.correct ? 'correct' : 'wrong'}
        >
          <strong>{outcome.correct ? '✓ 預測正確！' : '✗ 預測錯誤'}</strong>
          <p>
            你猜「{CHANGE_LABELS[guess]}」，結果燈泡<b>{CHANGE_LABELS[outcome.actual]}</b>。
          </p>
          <p className="muted">
            功率 {formatNumber(outcome.before)} W → {formatNumber(outcome.after)} W
          </p>
        </div>
      ) : (
        <div className="verdict wrong">
          <strong>無法判斷</strong>
          <p>{outcome.reason}</p>
        </div>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={() => onAction({ type: 'again' })}>
          再預測一次
        </button>
        {stop}
      </div>
    </section>
  );
}
