import { expect, test } from '@playwright/test';
import { EXAMPLES } from '../src/teaching/examples';
import { gridToScreen } from './helpers';

test('每個內建範例都能開啟，沒有問題提示，也沒有 NaN 或 Infinity', async ({ page }) => {
  await page.goto('/');
  for (const example of EXAMPLES) {
    await page.getByTestId('example-select').selectOption(example.id);
    await expect(page.locator('.note h2')).toContainText(example.title);
    await expect(page.locator('.ok-text')).toHaveText('接線沒有發現問題。');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/NaN|Infinity/);
  }
});

test('短路示範：閉合開關後標出電池並顯示說明，畫面不當掉', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('example-select').selectOption('short-circuit');
  const at = await gridToScreen(page);
  const p = at(26, 14);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.diagnostics li.error')).toContainText('短路');
  expect(await page.locator('body').innerText()).not.toMatch(/NaN|Infinity/);
  // 復原後回到正常
  await page.keyboard.press('Control+z');
  await expect(page.locator('.ok-text')).toBeVisible();
});

test('預測模式：閉合開關後判斷左邊燈泡變暗', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('example-select').selectOption('switch-prediction');
  await page.getByRole('button', { name: '開始預測' }).click();
  const at = await gridToScreen(page);
  const click = async (x: number, y: number) => {
    const p = at(x, y);
    await page.mouse.click(p.x, p.y);
  };
  await click(18, 14);
  await click(28, 12);
  await page.locator('[data-choice=dimmer]').click();
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.locator('.verdict')).toContainText('變暗');
});
