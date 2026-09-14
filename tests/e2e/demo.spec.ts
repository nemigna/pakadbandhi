import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import demo from "../../src/data/demo-project.v1.json" with { type: "json" };

test("supplied demo survives export, reload, and reset without losing project data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo mode · Export to save.")).toBeVisible();
  await expect(page.getByText("6 of 33 shots scheduled")).toBeVisible();
  await expect(page.getByTestId("cell-2026-09-19-morning")).toContainText(
    "SH 01",
  );
  await expect(
    page.getByRole("button", { name: "Select Chandrakanth", exact: true }),
  ).toBeVisible();
  const exportedProject = async () => {
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    const download = await pending;
    return JSON.parse(await fs.readFile((await download.path())!, "utf8"))
      .project;
  };
  expect(await exportedProject()).toEqual(demo.project);
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  await page.getByLabel("Project title").fill("Temporary edit");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  expect(await exportedProject()).toEqual(demo.project);
  await page.reload();
  expect(await exportedProject()).toEqual(demo.project);
});
