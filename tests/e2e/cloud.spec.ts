import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const demo = JSON.parse(
  readFileSync(
    new URL("../fixtures/demo-project.v1.json", import.meta.url),
    "utf8",
  ),
);

test("cloud loading, key errors and saving work on desktop and mobile", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/project", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        json: {
          project: demo.project,
          version: "6df5b1e7-0334-41b8-8e94-55af8543c878",
          savedAt: "2026-09-16T00:00:00.000Z",
        },
      });
    } else {
      attempts++;
      const key = request.headers().authorization;
      await route.fulfill(
        key === "Bearer valid-key"
          ? {
              json: {
                version: "dd7480a9-43fa-486d-8b8a-e07f7e5bba9d",
                savedAt: "2026-09-16T01:00:00.000Z",
              },
            }
          : {
              status: 401,
              json: { error: "Incorrect save key. Nothing was saved." },
            },
      );
    }
  });
  await page.goto("/");
  await expect(page.getByText("CLOUD PROJECT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save to cloud" }).click();
  await page.getByLabel("Save key", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Incorrect save key");
  await expect(page.getByLabel("Save key", { exact: true })).toHaveValue("");
  await page.getByLabel("Save key", { exact: true }).fill("valid-key");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Save to cloud" }).click();
  await expect(page.getByLabel("Save key", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "output/playwright/cloud-save-mobile.png" });
});
