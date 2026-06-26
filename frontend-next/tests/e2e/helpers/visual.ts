import { expect, type Page } from "@playwright/test";

const FIXED_TIME = new Date("2026-05-15T10:00:00.000Z");

/** Stabilize pages before visual snapshots (clock, animated media). */
export async function prepareVisualPage(page: Page) {
  await page.clock.install({ time: FIXED_TIME });
}

export async function stabilizeLoginMedia(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  });
}

/** Wait for async module content before taking a screenshot. */
export async function waitForScreenReady(page: Page, screenName: string) {
  await page.waitForLoadState("networkidle");

  if (screenName === "export") {
    await expect(
      page.getByText(/loading preview|ładowanie podglądu/i),
    ).toHaveCount(0, { timeout: 10_000 });
  }
}
