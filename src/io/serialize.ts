import {
  ELEMENT_LENGTH,
  GRID_HEIGHT,
  GRID_WIDTH,
  VALUE_RANGES,
  isInsideGrid,
  isValidValue,
  type ValueField,
} from '../model/elements';
import type { Circuit, CircuitElement, ElementKind, Point } from '../model/types';

const APP_ID = 'circuitlab-jr';
const FORMAT_VERSION = 1;
const MAX_ELEMENTS = 2000;

const KINDS: readonly ElementKind[] = [
  'battery',
  'resistor',
  'bulb',
  'switch',
  'wire',
  'ammeter',
  'voltmeter',
];

const FIELD_NAMES: Record<ValueField, string> = {
  resistance: '電阻值',
  emf: '電動勢',
  internalR: '內電阻',
};

export type ParseResult = { ok: true; circuit: Circuit } | { ok: false; error: string };

export function serializeCircuit(circuit: Circuit): string {
  return JSON.stringify({ app: APP_ID, version: FORMAT_VERSION, elements: circuit.elements });
}

class InvalidCircuit extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 解析並驗證電路檔；一律重新組裝乾淨的物件，丟棄多餘欄位。 */
export function parseCircuit(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '檔案內容不是有效的 JSON。' };
  }
  try {
    return { ok: true, circuit: toCircuit(data) };
  } catch (error) {
    if (error instanceof InvalidCircuit) return { ok: false, error: error.message };
    throw error;
  }
}

function toCircuit(data: unknown): Circuit {
  if (!isRecord(data) || data.app !== APP_ID || !Array.isArray(data.elements)) {
    throw new InvalidCircuit('這不是 CircuitLab Jr. 的電路檔。');
  }
  if (data.version !== FORMAT_VERSION) {
    throw new InvalidCircuit(`不支援的檔案版本：${String(data.version)}。`);
  }
  if (data.elements.length > MAX_ELEMENTS) {
    throw new InvalidCircuit(`元件數量超過上限 ${MAX_ELEMENTS} 個。`);
  }
  const seen = new Set<string>();
  const elements = data.elements.map((raw, index) => {
    const el = toElement(raw, `第 ${index + 1} 個元件`);
    if (seen.has(el.id)) throw new InvalidCircuit(`元件 id「${el.id}」重複。`);
    seen.add(el.id);
    return el;
  });
  return { version: 1, elements };
}

function toPoint(raw: unknown, where: string): Point {
  if (!isRecord(raw) || typeof raw.x !== 'number' || typeof raw.y !== 'number') {
    throw new InvalidCircuit(`${where}的座標格式錯誤。`);
  }
  const p = { x: raw.x, y: raw.y };
  if (!isInsideGrid(p)) {
    throw new InvalidCircuit(
      `${where}的座標超出畫布（0–${GRID_WIDTH} × 0–${GRID_HEIGHT} 的整數）。`,
    );
  }
  return p;
}

function toValue(raw: Record<string, unknown>, field: ValueField, where: string): number {
  const value = raw[field];
  if (typeof value !== 'number' || !isValidValue(field, value)) {
    const { min, max, unit } = VALUE_RANGES[field];
    throw new InvalidCircuit(
      `${where}的${FIELD_NAMES[field]}必須介於 ${min} 到 ${max} ${unit} 之間。`,
    );
  }
  return value;
}

function toElement(raw: unknown, where: string): CircuitElement {
  if (!isRecord(raw)) throw new InvalidCircuit(`${where}格式錯誤。`);
  const kind = raw.kind;
  if (typeof kind !== 'string' || !KINDS.includes(kind as ElementKind)) {
    throw new InvalidCircuit(`${where}的種類「${String(kind)}」無法辨識。`);
  }
  const id = raw.id;
  if (typeof id !== 'string' || id.length === 0 || id.length > 32) {
    throw new InvalidCircuit(`${where}的 id 必須是 1–32 個字元的字串。`);
  }
  const a = toPoint(raw.a, where);
  const b = toPoint(raw.b, where);
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx + dy === 0) throw new InvalidCircuit(`${where}的兩個端點不能在同一格點。`);
  if (
    kind !== 'wire' &&
    !((dx === ELEMENT_LENGTH && dy === 0) || (dx === 0 && dy === ELEMENT_LENGTH))
  ) {
    throw new InvalidCircuit(`${where}的長度必須是水平或垂直 ${ELEMENT_LENGTH} 格。`);
  }

  switch (kind as ElementKind) {
    case 'battery':
      return {
        kind: 'battery',
        id,
        a,
        b,
        emf: toValue(raw, 'emf', where),
        internalR: toValue(raw, 'internalR', where),
      };
    case 'resistor':
    case 'bulb':
      return {
        kind: kind as 'resistor' | 'bulb',
        id,
        a,
        b,
        resistance: toValue(raw, 'resistance', where),
      };
    case 'switch':
      if (typeof raw.closed !== 'boolean') throw new InvalidCircuit(`${where}的開關狀態格式錯誤。`);
      return { kind: 'switch', id, a, b, closed: raw.closed };
    default:
      return { kind: kind as 'wire' | 'ammeter' | 'voltmeter', id, a, b };
  }
}
