export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode = 'SINGULAR';

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  /** 有問題、需要在畫面上標示的元件 */
  readonly elementIds: readonly string[];
  /** 學生看得懂的一句話 */
  readonly message: string;
}

const MESSAGES: Record<DiagnosticCode, string> = {
  SINGULAR: '這個電路的接法無法計算出合理的結果，請檢查接線。',
};

const SEVERITY: Record<DiagnosticCode, DiagnosticSeverity> = {
  SINGULAR: 'error',
};

export function diagnostic(code: DiagnosticCode, elementIds: readonly string[]): Diagnostic {
  return { severity: SEVERITY[code], code, elementIds, message: MESSAGES[code] };
}
