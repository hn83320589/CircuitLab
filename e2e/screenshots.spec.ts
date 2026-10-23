import { test } from '@playwright/test';
import { gridToScreen } from './helpers';

// 產生 README 用的截圖：SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
test.skip(!process.env.SCREENSHOTS, '只在需要更新 README 截圖時執行');

const OUT = 'docs/images';

test('README 截圖', async ({ page }) => {
  await page.goto('/');

  // 編輯電路：選取元件、屬性面板
  await page.getByTestId('example-select').selectOption('meters');
  const at = await gridToScreen(page);
  let p = at(18, 10);
  await page.mouse.click(p.x, p.y);
  await page.screenshot({ path: `${OUT}/editor.png` });

  // 電流動畫：串並聯對照
  await page.getByTestId('example-select').selectOption('comparison');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/flow.png` });

  // 錯誤提示：短路
  await page.getByTestId('example-select').selectOption('short-circuit');
  p = at(26, 14);
  await page.mouse.click(p.x, p.y);
  await page.screenshot({ path: `${OUT}/error.png` });

  // 預測模式
  await page.getByTestId('example-select').selectOption('switch-prediction');
  await page.getByRole('button', { name: '開始預測' }).click();
  for (const [x, y] of [
    [18, 14],
    [28, 12],
  ] as const) {
    const q = at(x, y);
    await page.mouse.click(q.x, q.y);
  }
  await page.locator('[data-choice=dimmer]').click();
  await page.screenshot({ path: `${OUT}/prediction-guess.png` });
  await page.locator('[data-action=reveal]').click();
  await page.screenshot({ path: `${OUT}/prediction-result.png` });
});
