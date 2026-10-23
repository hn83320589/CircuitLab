import { describe, expect, it } from 'vitest';
import type { Circuit } from '../model/types';
import { benchmarkCircuit } from '../perf/benchmarkCircuit';
import { solve } from '../solver/solve';
import { EXAMPLES } from '../teaching/examples';
import { parseCircuit, serializeCircuit } from './serialize';
import { decodeShareFragment, encodeShareFragment } from './shareLink';

const circuits: [string, Circuit][] = [
  ...EXAMPLES.map((e) => [e.title, e.circuit] as [string, Circuit]),
  ['200 個元件的基準電路', benchmarkCircuit()],
];

describe('JSON 存檔', () => {
  it.each(circuits)('%s：存檔再讀回，電路與求解結果都相同', (_, circuit) => {
    const parsed = parseCircuit(serializeCircuit(circuit));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.circuit).toEqual(circuit);
    expect(solve(parsed.circuit)).toEqual(solve(circuit));
  });

  it('存檔格式帶有 app 與 version 欄位', () => {
    const json = JSON.parse(serializeCircuit(benchmarkCircuit())) as Record<string, unknown>;
    expect(json.app).toBe('circuitlab-jr');
    expect(json.version).toBe(1);
  });

  const valid = {
    kind: 'resistor',
    id: 'r1',
    a: { x: 1, y: 1 },
    b: { x: 3, y: 1 },
    resistance: 10,
  };
  const file = (elements: unknown[]) =>
    JSON.stringify({ app: 'circuitlab-jr', version: 1, elements });

  it.each([
    ['不是 JSON', '{oops', '不是有效的 JSON'],
    ['不是本工具的檔案', JSON.stringify({ hello: 1 }), '不是 CircuitLab Jr. 的電路檔'],
    ['版本不支援', JSON.stringify({ app: 'circuitlab-jr', version: 9, elements: [] }), '版本'],
    ['電阻值超出範圍', file([{ ...valid, resistance: -5 }]), '電阻'],
    ['電阻值不是數字', file([{ ...valid, resistance: 'abc' }]), '電阻'],
    ['元件 id 重複', file([valid, valid]), '重複'],
    ['座標超出畫布', file([{ ...valid, a: { x: 70, y: 1 }, b: { x: 72, y: 1 } }]), '畫布'],
    ['元件長度不對', file([{ ...valid, b: { x: 6, y: 1 } }]), '長度'],
    ['未知的元件種類', file([{ ...valid, kind: 'capacitor' }]), '種類'],
  ])('拒絕壞檔：%s', (_, text, keyword) => {
    const parsed = parseCircuit(text);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain(keyword);
  });

  it('丟棄多餘的欄位', () => {
    const parsed = parseCircuit(file([{ ...valid, evil: '<script>' }]));
    expect(parsed.ok && parsed.circuit.elements[0]).toEqual(valid);
  });
});

describe('分享連結', () => {
  it.each(circuits)('%s：編碼再解碼，電路與求解結果都相同', async (_, circuit) => {
    const fragment = await encodeShareFragment(circuit);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeShareFragment(fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.circuit).toEqual(circuit);
    expect(solve(decoded.circuit)).toEqual(solve(circuit));
  });

  it('200 個元件的電路，連結長度仍在合理範圍', async () => {
    const fragment = await encodeShareFragment(benchmarkCircuit());
    expect(fragment.length).toBeLessThan(8000);
  });

  it('損壞的連結回報錯誤而不是拋出例外', async () => {
    const decoded = await decodeShareFragment('not-a-valid-link');
    expect(decoded.ok).toBe(false);
  });
});
