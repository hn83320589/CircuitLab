export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  | 'BATTERY_SHORTED'
  | 'AMMETER_SHORTS_BATTERY'
  | 'CONFLICTING_SOURCES'
  | 'SOURCE_LOOP'
  | 'SHORT_CIRCUIT_WARNING'
  | 'DANGLING'
  | 'VOLTMETER_UNCONNECTED'
  | 'VOLTMETER_IN_SERIES'
  | 'SINGULAR';

export interface Diagnostic {
  /** error：所在電路無法得到合理結果；warning：有結果，但接法不合理 */
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  /** 有問題、需要在畫面上標示的元件 */
  readonly elementIds: readonly string[];
  /** 學生看得懂的一句話 */
  readonly message: string;
}

const CATALOG: Record<DiagnosticCode, { severity: DiagnosticSeverity; message: string }> = {
  BATTERY_SHORTED: {
    severity: 'error',
    message: '電池的兩端被導線直接接在一起（短路），電流會大到無法計算。請在中間接上燈泡或電阻。',
  },
  AMMETER_SHORTS_BATTERY: {
    severity: 'error',
    message: '電流計的電阻是 0，直接接在電池兩端會造成短路。電流計要和元件「串聯」。',
  },
  CONFLICTING_SOURCES: {
    severity: 'error',
    message: '兩個電壓不同的電池直接並聯，電壓互相矛盾，無法計算。',
  },
  SOURCE_LOOP: {
    severity: 'error',
    message: '這幾個電池直接接成一圈，無法決定各自的電流。請替電池設定內電阻。',
  },
  SHORT_CIRCUIT_WARNING: {
    severity: 'warning',
    message: '電池被短路了，電流非常大，實際上電池會發燙，很危險。',
  },
  DANGLING: {
    severity: 'warning',
    message: '這個元件有一端沒有接上（沒有形成通路），所以不會有電流通過。',
  },
  VOLTMETER_UNCONNECTED: {
    severity: 'warning',
    message: '電壓計有一端沒有接到電路上，無法量測。',
  },
  VOLTMETER_IN_SERIES: {
    severity: 'warning',
    message: '電壓計應該「並聯」在要量測的元件兩端；串聯在電路中會讓電流幾乎無法流動。',
  },
  SINGULAR: {
    severity: 'error',
    message: '這個電路的接法無法計算出合理的結果，請檢查接線。',
  },
};

export function diagnostic(code: DiagnosticCode, elementIds: readonly string[]): Diagnostic {
  return { code, elementIds, ...CATALOG[code] };
}
