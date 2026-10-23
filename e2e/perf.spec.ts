import { expect, test } from '@playwright/test';
import { benchmarkCircuit } from '../src/perf/benchmarkCircuit';
import { gridToScreen, openCircuit } from './helpers';

const RUNS = 30;
const BUDGET_MS = 100;

test('200 個元件：修改一個電阻值到畫面更新完成在 100 ms 內', async ({ page }, testInfo) => {
  const circuit = benchmarkCircuit();
  await openCircuit(page, circuit);
  expect(await page.locator('[data-element-id]').count()).toBe(circuit.elements.length);

  // e4 是網格左上角的第一個電阻，中點在 (9, 6)
  const at = await gridToScreen(page);
  const p = at(9, 6);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('input[data-field=resistance]')).toBeVisible();

  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const value = 11 + i;
    const result = await page.evaluate(async (v) => {
      const input = document.querySelector<HTMLInputElement>('input[data-field=resistance]');
      if (!input) throw new Error('找不到電阻輸入框');
      // 受控元件：用原生 setter 設值，再觸發 input 事件讓 React 更新草稿
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(v));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

      const label = () => document.querySelector('[data-element-id="e4"] > text:last-of-type');
      const before = label()?.textContent;
      const start = performance.now();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // 等到下一幀繪製完成：rAF 在繪製前執行，其後的 macrotask 在繪製之後
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const elapsed = performance.now() - start;
      return { elapsed, changed: label()?.textContent !== before };
    }, value);
    expect(result.changed, '畫面上的數值應該已更新').toBe(true);
    samples.push(result.elapsed);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
  const summary = {
    runs: RUNS,
    elements: circuit.elements.length,
    medianMs: Number(pick(0.5).toFixed(1)),
    p95Ms: Number(pick(0.95).toFixed(1)),
    maxMs: Number((sorted.at(-1) as number).toFixed(1)),
  };
  console.log('效能量測結果', JSON.stringify(summary));
  await testInfo.attach('perf.json', {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
  expect(summary.p95Ms).toBeLessThan(BUDGET_MS);
});
