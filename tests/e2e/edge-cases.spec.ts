import { loadFixture } from "./load-fixture";
import { test, expect } from "@playwright/test";
import { createTestProject as createDemoProject } from "../fixtures/project";
import { serializeProject } from "../../src/domain/schema";

test("reorder using the scheduling dialog, then return a shot to the shelf", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  await page
    .getByRole("button", { name: "Schedule SH 012", exact: true })
    .click();
  await page.getByLabel("Shooting date", { exact: true }).fill("2026-09-21");
  await page.getByRole("button", { name: "Place shot", exact: true }).click();
  await page
    .getByRole("button", { name: "Schedule SH 014", exact: true })
    .click();
  await page.getByLabel("Shooting date", { exact: true }).fill("2026-09-21");
  await page.getByLabel("Filming order").selectOption("1");
  await page.getByRole("button", { name: "Place shot", exact: true }).click();
  const cell = page.getByTestId("cell-2026-09-21-morning");
  await expect(cell.locator("article").first()).toContainText("SH 012");
  await cell.getByRole("button", { name: "Schedule SH 014" }).click();
  await page.getByLabel("Filming order").selectOption("0");
  await page.getByRole("button", { name: "Place shot", exact: true }).click();
  await expect(cell.locator("article").first()).toContainText("SH 014");
  await expect(cell).toContainText("135");
  await cell.getByRole("button", { name: "Schedule SH 014" }).click();
  await page.getByRole("button", { name: "Unschedule", exact: true }).click();
  await expect(
    page.locator(".shot-shelf").getByTestId("shot-SH-014"),
  ).toBeVisible();
  await expect(page.getByTestId("shot-SH-014")).toHaveCount(1);
});

test("all-day and partial availability, core-crew propagation and dependency protection", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  await page
    .getByRole("button", { name: "Set 2026-09-21 all day unavailable" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Ravi 2026-09-21 Morning: unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Paint available", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Ravi 2026-09-21 Afternoon: unavailable",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Ravi 2026-09-21 Afternoon: available",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Ravi 2026-09-21 Morning: unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Ravi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete person" }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("SH 012");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Select Dev", exact: true }).click();
  await page
    .getByRole("button", { name: "Paint unavailable", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set 2026-09-20 all day unavailable" })
    .click();
  await expect(
    page.getByTestId("cell-2026-09-20-morning").getByTestId("shot-SH-001"),
  ).toContainText("Dev is unavailable");
});

test("valid conflicting files import while invalid references leave the active project untouched", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  const project = createDemoProject();
  project.people.find((p) => p.id === "dev")!.defaultAvailability =
    "unavailable";
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "conflicts.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeProject(project)),
  });
  await expect(page.getByRole("dialog")).toContainText("4 conflicts");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import project" })
    .click();
  await expect(page.getByRole("button", { name: /4 conflicts/ })).toBeVisible();
  const invalid = JSON.parse(serializeProject(project));
  invalid.project.assignments[0].shotId = "missing";
  await page.getByLabel("Import project JSON file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.locator(".toast")).toContainText("Unknown shot");
  await expect(page.getByText("4 of 8 shots scheduled")).toBeVisible();
});

test("theme follows system changes without storing project or preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await loadFixture(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: /Place selected shot on 21 Sept? · Morning/ })
    .click();
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.getByText("5 of 8 shots scheduled")).toBeVisible();
  await expect(
    page.getByText("Changes not exported.", { exact: true }),
  ).toBeVisible();
});

test("production dates remain consistent for viewers in distant timezones", async ({
  browser,
}) => {
  for (const timezoneId of ["America/Los_Angeles", "Pacific/Auckland"]) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173");
    await loadFixture(page);
    await expect(page.getByTestId("cell-2026-09-20-morning")).toContainText(
      "06:00–07:15",
    );
    await expect(
      page.locator(".date-navigation").getByText(/20 Sept? – 24 Sept?/),
    ).toBeVisible();
    await context.close();
  }
});

test("drag reorders an occupied session and returns a shot to the shelf", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page);
  for (const code of ["SH 012", "SH 014"]) {
    await page
      .getByRole("button", { name: `Schedule ${code}`, exact: true })
      .click();
    await page.getByLabel("Shooting date", { exact: true }).fill("2026-09-21");
    await page
      .getByLabel("Filming order")
      .selectOption(code === "SH 012" ? "0" : "1");
    await page.getByRole("button", { name: "Place shot", exact: true }).click();
  }
  const cell = page.getByTestId("cell-2026-09-21-morning");
  const startDrag = async () => {
    await page.waitForTimeout(500);
    const box = await cell
      .getByRole("button", { name: "Drag SH 014", exact: true })
      .boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 15, box!.y + 15, { steps: 5 });
    await page.waitForTimeout(200);
  };
  await startDrag();
  const insert = cell.getByRole("button", {
    name: "Insert selected shot at position 1 on 2026-09-21 morning",
    exact: true,
  });
  const target = await insert.boundingBox();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 15 },
  );
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(cell.locator("article").first()).toContainText("SH 014");
  await startDrag();
  const shelf = await page.locator(".shelf-drop").boundingBox();
  await page.mouse.move(shelf!.x + shelf!.width / 2, shelf!.y + 10, {
    steps: 20,
  });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(
    page.locator(".shot-shelf").getByTestId("shot-SH-014"),
  ).toBeVisible();
  await expect(page.getByTestId("shot-SH-014")).toHaveCount(1);
});
