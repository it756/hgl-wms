import { expect, test } from "@playwright/test";

test.describe("public smoke", () => {
  test("renders the sign-in page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Harvest WMS").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("renders the forgot password page", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await expect(page.getByText("send you a secure password reset link")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();
  });
});
