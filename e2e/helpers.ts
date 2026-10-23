import type { Page } from '@playwright/test';
import { buildShareUrl } from '../src/io/shareLink';
import type { Circuit } from '../src/model/types';

/** 以分享連結開啟指定電路 */
export async function openCircuit(page: Page, circuit: Circuit): Promise<void> {
  const url = await buildShareUrl(circuit, 'http://localhost:4173/');
  await page.goto(url);
  await page.locator(`[data-element-id="${circuit.elements.at(-1)?.id}"]`).waitFor();
}

/** 格點座標 → 螢幕座標（viewBox 為 -20 -20 1240 840，等比置中） */
export async function gridToScreen(page: Page) {
  const box = await page.locator('svg.circuit-canvas').boundingBox();
  if (!box) throw new Error('找不到畫布');
  const vb = { x: -20, y: -20, w: 1240, h: 840 };
  const scale = Math.min(box.width / vb.w, box.height / vb.h);
  const ox = box.x + (box.width - vb.w * scale) / 2;
  const oy = box.y + (box.height - vb.h * scale) / 2;
  return (gx: number, gy: number) => ({
    x: ox + (gx * 20 - vb.x) * scale,
    y: oy + (gy * 20 - vb.y) * scale,
  });
}
