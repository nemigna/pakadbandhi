import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { makeProject } from "../performance-entry";
import { serializeProject } from "../../src/domain/schema";
test("profiles production-compiled preview rules and typical edit feedback", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.addScriptTag({ path: "output/playwright/performance.js" });
  const measurements = await page.evaluate(() =>
    (
      window as unknown as {
        PakadbandiBenchmark: {
          measurePreview: () => { medianMs: number; maxMs: number };
        };
      }
    ).PakadbandiBenchmark.measurePreview(),
  );
  expect(measurements.medianMs).toBeLessThan(50);
  const project = makeProject();
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "typical.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeProject(project)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import project" })
    .click();
  const feedbackMs = await page.evaluate(async () => {
    const button =
      document.querySelector<HTMLButtonElement>(".availability-cell")!;
    const start = performance.now();
    button.click();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return performance.now() - start;
  });
  const report = {
    browser: testInfo.project.name,
    ...measurements,
    editToPaintMs: feedbackMs,
  };
  await fs.writeFile(
    `output/playwright/performance-${testInfo.project.name}.json`,
    JSON.stringify(report, null, 2),
  );
  await testInfo.attach("performance", {
    body: JSON.stringify(report),
    contentType: "application/json",
  });
  await expect(
    page.getByText("Changes not exported.", { exact: true }),
  ).toBeVisible();
});
