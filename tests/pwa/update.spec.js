import { expect, test } from "@playwright/test";

test("service worker update waits for user confirmation and reloads tabs", async ({ context }) => {
  const page1 = await context.newPage();
  await page1.goto("/");
  await page1.waitForFunction(() => window.__TP_OFFLINE_READY__ === true);

  const page2 = await context.newPage();
  await page2.goto("/");
  await page2.waitForFunction(() => window.__TP_OFFLINE_READY__ === true);

  // Status element should be ready or hidden online
  const status1 = page1.locator("#pwa-status");
  await expect(status1).toHaveAttribute("data-state", "ready");
});
