import { loadFixture } from "./load-fixture";
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const shotCard = (page: Page, code: string) => page.getByTestId(`shot-${code}`);
const setTheme = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    name.toLowerCase(),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
};
test("demo, blocked placement, valid placement, export/reset/import and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await loadFixture(page);
  await expect(
    page.getByRole("heading", { name: "Shooting schedule" }),
  ).toBeVisible();
  await expect(
    page.getByText("Imported project · Export to save changes."),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /Place selected shot on 20 Sept? · Afternoon/,
    })
    .click();
  await expect(page.locator(".toast")).toContainText("Ravi is unavailable");
  await expect(page.getByText("Changes not exported.")).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page
    .getByRole("button", { name: /Place selected shot on 21 Sept? · Morning/ })
    .click();
  await expect(
    page.getByTestId("cell-2026-09-21-morning").getByTestId("shot-SH-012"),
  ).toBeVisible();
  await expect(shotCard(page, "SH-012")).toHaveCount(1);
  await expect(
    page.getByText("Changes not exported.", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const data = JSON.parse(await fs.readFile(path!, "utf8"));
  expect(data.project.assignments).toHaveLength(5);
  expect(data.format).toBe("pakadbandi-project");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(page.getByText("2 of 29 shots scheduled")).toBeVisible();
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole("dialog")).toContainText("5 scheduled");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import project" })
    .click();
  await expect(
    page.getByText("Imported project · Export to save changes."),
  ).toBeVisible();
  await expect(
    page.getByTestId("cell-2026-09-21-morning").getByTestId("shot-SH-012"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 of 29 shots scheduled")).toBeVisible();
  expect(errors).toEqual([]);
});
test("shot editing, availability conflicts, tentative placement and settings", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  await page.getByRole("button", { name: "Edit SH 012", exact: true }).click();
  await page.getByLabel("Shot title").fill("The kitchen conversation");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", {
      name: "The kitchen conversation",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit availability range" }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-09-21");
  await page.getByLabel("Through", { exact: true }).fill("2026-09-21");
  await page.getByRole("button", { name: "Apply availability" }).click();
  await expect(page.getByRole("button", { name: /conflicts/ })).toContainText(
    "1 conflicts",
  );
  await page
    .getByRole("button", { name: "Schedule SH 021", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Meera is unconfirmed");
  await page.getByRole("button", { name: "Place shot", exact: true }).click();
  await expect(
    page.getByTestId("cell-2026-09-20-morning").getByTestId("shot-SH-021"),
  ).toContainText("Tentative");
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  await page.getByLabel("Project title").fill("Our first film");
  await page.getByLabel("Production timezone").fill("Europe/London");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("button", { name: "Our first film" }),
  ).toBeVisible();
});
test("keyboard scheduling, reset safeguards and malformed import", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  const schedule = page.getByRole("button", {
    name: "Schedule SH 012",
    exact: true,
  });
  await schedule.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Shooting date", { exact: true }).fill("2026-09-21");
  await page.getByRole("button", { name: "Place shot", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByTestId("cell-2026-09-21-morning").getByTestId("shot-SH-012"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Export first" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("5 of 8 shots scheduled")).toBeVisible();
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.locator(".toast")).toContainText("Import failed");
  await expect(page.getByText("5 of 8 shots scheduled")).toBeVisible();
});
test("light, dark and narrow layouts with editable people", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await loadFixture(page);
  await setTheme(page, "Light");
  await page.screenshot({
    path: `output/playwright/desktop-light-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await setTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Select SH 012 The conversation" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `output/playwright/desktop-dark-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `output/playwright/mobile-dark-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page.getByLabel("Display name").fill("Sam");
  await page.getByLabel("Role", { exact: true }).fill("Gaffer");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await setTheme(page, "Light");
  await page.screenshot({
    path: `output/playwright/mobile-people-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Shots", exact: true }).click();
  await page
    .getByRole("button", { name: "Schedule SH 012", exact: true })
    .click();
  await page.getByLabel("Shooting date", { exact: true }).fill("2026-09-21");
  await page.getByRole("button", { name: "Place shot", exact: true }).click();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page.getByLabel("Jump to shooting date").fill("2026-09-21");
  await expect(
    page.getByTestId("cell-2026-09-21-morning").getByTestId("shot-SH-012"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.screenshot({
    path: `output/playwright/mobile-light-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("drag placement, blocked drag and cancellation", async ({ page }) => {
  await page.goto("/");
  await loadFixture(page);
  const drag = async (targetId: string) => {
    await page.waitForTimeout(500);
    const handle = await page
      .getByRole("button", { name: "Drag SH 012", exact: true })
      .boundingBox();
    const target = await page.getByTestId(targetId).boundingBox();
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(handle!.x + 12, handle!.y + 12, { steps: 4 });
    await page.waitForTimeout(200);
    await page.mouse.move(
      target!.x + target!.width / 2,
      target!.y + target!.height - 20,
      { steps: 20 },
    );
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect(page.locator('[data-dropping="true"]')).toHaveCount(0);
  };
  await drag("cell-2026-09-20-afternoon");
  await expect(page.locator(".toast")).toContainText("Ravi");
  await expect(page.getByText("4 of 8 shots scheduled")).toBeVisible();
  await drag("cell-2026-09-21-morning");
  await expect(
    page.getByTestId("cell-2026-09-21-morning").getByTestId("shot-SH-012"),
  ).toBeVisible();
  const handle = await page
    .getByRole("button", { name: "Drag SH 014", exact: true })
    .boundingBox();
  await page.mouse.move(handle!.x + 5, handle!.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 40, handle!.y + 40, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByText("5 of 8 shots scheduled")).toBeVisible();
});
