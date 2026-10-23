import type { Diagnostic } from '../solver/diagnostics';

interface DiagnosticsPanelProps {
  diagnostics: readonly Diagnostic[];
  onSelect: (elementId: string) => void;
}

export function DiagnosticsPanel({ diagnostics, onSelect }: DiagnosticsPanelProps) {
  return (
    <section className="panel" aria-label="接線檢查">
      <h2>接線檢查</h2>
      {diagnostics.length === 0 ? (
        <p className="ok-text">接線沒有發現問題。</p>
      ) : (
        <ul className="diagnostics">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${i}`} className={d.severity} data-code={d.code}>
              <button
                type="button"
                onClick={() => d.elementIds[0] && onSelect(d.elementIds[0])}
                title="點一下選取有問題的元件"
              >
                <strong>{d.severity === 'error' ? '無法計算' : '注意'}</strong>
                {d.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
