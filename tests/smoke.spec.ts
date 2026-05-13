import { expect, test } from "@playwright/test";

test("homepage renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lehrplan-Tagger" })).toBeVisible();
});

test("teacher can login and reach dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("teacher@example.com");
  await page.getByLabel("Passwort").fill("teacher");
  await page.getByRole("button", { name: "Einloggen" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
