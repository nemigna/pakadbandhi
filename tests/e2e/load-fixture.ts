import { type Page } from "@playwright/test";
import fixture from "../fixtures/demo-project.v1.json" with { type: "json" };

// Scheduling regression scenarios use their own stable, deliberately varied fixture.
export async function loadFixture(page: Page) {
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import project", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Select SH 012 The conversation",
      exact: true,
    })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
}
