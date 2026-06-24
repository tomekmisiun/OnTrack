import type { Page } from "@playwright/test";

const FIXED_TIME = new Date("2026-05-15T10:00:00.000Z");

/** Stabilize pages before visual snapshots (clock, tour, animated media). */
export async function prepareVisualPage(
  page: Page,
  options: { authenticated?: boolean } = {},
) {
  await page.clock.install({ time: FIXED_TIME });

  await page.addInitScript((authenticated) => {
    if (authenticated) {
      localStorage.setItem("mealplanner_tour_done_1", "1");
    }
  }, options.authenticated ?? false);
}

export async function stabilizeLoginMedia(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  });
}
