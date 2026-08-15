import { expect, test } from "@playwright/test";

test("reading features work offline", async ({ page, context }) => {
  const externalRequests = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:8787") {
      externalRequests.push(url.href);
    }
  });

  await page.goto("/");
  await page.waitForFunction(() => window.__TP_OFFLINE_READY__ === true);
  await page.reload();

  const firstChapter = page
    .locator('[data-testid="chapter-link"]')
    .first();
  const chapterUrl = await firstChapter.getAttribute("href");
  expect(chapterUrl).toBeTruthy();

  await page.goto(chapterUrl);
  await expect(page.locator('[data-testid="content-area"]')).not.toBeEmpty();

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('[data-testid="content-area"]')).not.toBeEmpty();
  await expect(page.locator("pre code").first()).toBeVisible();

  const search = page.locator('[data-testid="search-input"]');
  await search.fill("system design");
  await expect(page.locator('[data-testid="search-result"]').first()).toBeVisible();

  const mermaid = page.locator('[data-testid="mermaid-diagram"]').first();
  if (await mermaid.count()) {
    await expect(mermaid.locator("svg")).toBeVisible();
  }

  const mindMap = page.locator('[data-testid="mind-map"]').first();
  if (await mindMap.count()) {
    await expect(mindMap.locator("svg")).toBeVisible();
  }

  expect(
    externalRequests.filter(url =>
      url.includes("marked") ||
      url.includes("highlight") ||
      url.includes("mermaid") ||
      url.includes("pako") ||
      url.includes("fuse")
    )
  ).toEqual([]);
});
