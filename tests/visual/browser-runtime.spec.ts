import { expect, test } from "@playwright/test";

test("production browser runtime starts without Node globals or uncaught errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    // A browser does not provide Node's `global`; this catches accidental runtime references.
    Object.defineProperty(window, "global", {
      configurable: true,
      value: undefined,
      writable: true,
    });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  expect(pageErrors).toEqual([]);

});
