import { test, expect } from "@playwright/test";

test("renders Mentora interface shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Mentora")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sources" })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
});
