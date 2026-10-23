import { useState, type Dispatch } from 'react';
import type { EditorAction } from '../editor/reducer';
import { formatNumber } from '../format';
import { KIND_LABELS, VALUE_RANGES, isValidValue, type ValueField } from '../model/elements';
import type { CircuitElement } from '../model/types';
import type { ElementResult } from '../solver/solve';

interface PropertyPanelProps {
  element: CircuitElement | undefined;
  result: ElementResult | null | undefined;
  dispatch: Dispatch<EditorAction>;
}

const FIELD_LABELS: Record<ValueField, string> = {
  resistance: '電阻',
  emf: '電動勢',
  internalR: '內電阻',
};

export function PropertyPanel({ element, result, dispatch }: PropertyPanelProps) {
  if (!element) {
    return (
      <section className="panel" aria-label="元件屬性">
        <h2>元件屬性</h2>
        <p className="muted">點選畫布上的元件，可以修改數值、查看電流與電壓。</p>
      </section>
    );
  }

  const fields: ValueField[] =
    element.kind === 'battery'
      ? ['emf', 'internalR']
      : element.kind === 'resistor' || element.kind === 'bulb'
        ? ['resistance']
        : [];

  return (
    <section className="panel" aria-label="元件屬性">
      <h2>
        {KIND_LABELS[element.kind]} <span className="muted">{element.id}</span>
      </h2>
      {fields.map((field) => {
        const value = (element as unknown as Record<ValueField, number>)[field];
        return (
          <NumberField
            // 數值被外部改變（例如 Undo）時重新掛載，草稿跟著重設
            key={`${element.id}-${field}-${value}`}
            label={FIELD_LABELS[field]}
            field={field}
            value={value}
            onCommit={(v) => dispatch({ type: 'setValue', id: element.id, field, value: v })}
          />
        );
      })}
      {element.kind === 'switch' && (
        <button
          type="button"
          className="wide"
          onClick={() => dispatch({ type: 'toggleSwitch', id: element.id })}
        >
          {element.closed ? '目前：閉合 → 按下斷開' : '目前：斷開 → 按下閉合'}
        </button>
      )}
      <div className="row">
        <button type="button" onClick={() => dispatch({ type: 'rotate', id: element.id })}>
          旋轉 90°（R）
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => dispatch({ type: 'delete', id: element.id })}
        >
          刪除（Del）
        </button>
      </div>
      <ResultTable element={element} result={result} />
    </section>
  );
}

function NumberField(props: {
  label: string;
  field: ValueField;
  value: number;
  onCommit: (value: number) => void;
}) {
  const { label, field, value, onCommit } = props;
  const [draft, setDraft] = useState(String(value));
  const range = VALUE_RANGES[field];
  const parsed = Number(draft);
  const valid = draft.trim() !== '' && isValidValue(field, parsed);
  const commit = () => {
    if (valid && parsed !== value) onCommit(parsed);
  };
  return (
    <label className="field">
      <span>
        {label}（{range.unit}）
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={!valid}
        data-field={field}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(String(value));
        }}
      />
      {!valid && (
        <small className="error-text">
          請輸入 {range.min} 到 {range.max} 之間的數字
        </small>
      )}
    </label>
  );
}

function ResultTable({
  element,
  result,
}: {
  element: CircuitElement;
  result: ElementResult | null | undefined;
}) {
  if (!result) {
    return <p className="muted">這個元件目前無法得到數值。</p>;
  }
  const rows: [string, string][] = [];
  const current = formatNumber(Math.abs(result.current));
  const direction =
    Math.abs(result.current) < 1e-9 ? '' : result.current > 0 ? '（a → b）' : '（b → a）';
  if (element.kind === 'battery') {
    rows.push(['電流', `${current} A${direction}`]);
    rows.push(['端電壓', `${formatNumber(-result.voltage)} V`]);
    rows.push(['提供功率 E·I', `${formatNumber(element.emf * result.current)} W`]);
    rows.push(['內電阻消耗 I²r', `${formatNumber(result.current ** 2 * element.internalR)} W`]);
    rows.push(['輸出功率', `${formatNumber(-result.power)} W`]);
  } else if (element.kind === 'voltmeter') {
    rows.push(['讀數', `${formatNumber(Math.abs(result.voltage))} V`]);
  } else if (element.kind === 'ammeter') {
    rows.push(['讀數', `${current} A${direction}`]);
  } else {
    rows.push(['電流', `${current} A${direction}`]);
    rows.push(['兩端電壓', `${formatNumber(Math.abs(result.voltage))} V`]);
    rows.push(['功率', `${formatNumber(result.power)} W`]);
  }
  return (
    <table className="results">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
