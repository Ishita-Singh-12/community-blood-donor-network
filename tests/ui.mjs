import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const url = process.env.TEST_URL || "http://127.0.0.1:4173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
const errors = [];
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const hospital = await context.newPage(),
  donor = await context.newPage();
await hospital.goto(url);
await hospital
  .getByRole("heading", { name: "Every connection counts." })
  .waitFor();
await hospital.getByText("Live connection", { exact: true }).waitFor();
await hospital.evaluate(() => document.fonts.ready);
await hospital.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
await donor.goto(url);
await donor.getByRole("button", { name: "Donor portal", exact: true }).click();
await donor.getByRole("heading", { name: "Nearby requests for you" }).waitFor();
await hospital.getByRole("button", { name: "Create blood request" }).click();
await hospital.getByRole("dialog").waitFor();
await hospital.screenshot({
  path: "artifacts/create-request.png",
  fullPage: true,
});
await hospital.getByRole("button", { name: "Create & notify donors" }).click();
await donor.getByText("New donor connection", { exact: true }).waitFor();
await donor.getByText("Live connection", { exact: true }).waitFor();
await donor.screenshot({ path: "artifacts/donor-alert.png", fullPage: true });
const latest = await donor.locator(".alert-banner p").first().textContent();
assert.ok(latest.includes("rank #1"));
const newCard = donor.locator(".request-card").first();
await newCard.getByRole("button", { name: "I can help", exact: true }).click();
await newCard.getByRole("button", { name: "Response confirmed" }).waitFor();
const state = await (await fetch(url + "/api/state")).json();
const current = state.requests[0];
assert.ok(current.acceptedDonors.includes("d1"));
assert.equal(current.status, "Scheduled");
await hospital
  .getByRole("button", { name: "Blood requests", exact: true })
  .click();
await hospital
  .locator("tr")
  .filter({ hasText: current.id })
  .getByText("Scheduled", { exact: true })
  .waitFor();
await hospital
  .locator("tr")
  .filter({ hasText: current.id })
  .getByRole("button")
  .click();
await hospital.getByText("Matching donors, nearest first").waitFor();
await hospital.screenshot({
  path: "artifacts/nearest-matches.png",
  fullPage: true,
});
await hospital.getByRole("button", { name: "Close request details" }).click();
await hospital
  .getByRole("button", { name: "Donor directory", exact: true })
  .click();
await hospital.getByRole("textbox", { name: "Search donors" }).fill("Ananya");
assert.equal(await hospital.locator(".donor-card").count(), 1);
await hospital.getByRole("textbox", { name: "Search donors" }).fill("nobody");
assert.equal(await hospital.locator(".donor-card").count(), 0);
await hospital.getByRole("textbox", { name: "Search donors" }).fill("");
await hospital
  .getByRole("combobox", { name: "Filter blood group" })
  .selectOption("O+");
assert.equal(await hospital.locator(".donor-card").count(), 6);
await hospital
  .getByRole("button", { name: "Blood inventory", exact: true })
  .click();
const units = hospital.getByRole("spinbutton", { name: "O+ inventory units" });
await units.fill("8");
await hospital
  .getByRole("heading", { name: "Community inventory", exact: true })
  .click();
await donor.getByRole("button", { name: "Overview", exact: true }).click();
await donor
  .locator(".blood-card")
  .filter({ hasText: "O+" })
  .getByText("8", { exact: true })
  .waitFor();
await hospital.getByRole("button", { name: "Overview", exact: true }).click();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
});
const mp = await mobile.newPage();
mp.on("pageerror", (e) => errors.push(e.message));
await mp.goto(url);
await mp.getByRole("heading", { name: "Every connection counts." }).waitFor();
assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
await mp.getByText("Live connection", { exact: true }).waitFor();
await mp.screenshot({
  path: "artifacts/mobile-dashboard.png",
  fullPage: false,
});
await mp.waitForTimeout(300);
await mp.getByRole("button", { name: "Donor portal", exact: true }).click();
await mp.getByRole("heading", { name: "Nearby requests for you" }).waitFor();
assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
await mp.screenshot({ path: "artifacts/mobile-donor.png", fullPage: true });
await mp.getByRole("button", { name: "Create blood request" }).click();
await mp.getByRole("dialog").waitFor();
assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= 390));
assert.deepEqual(errors, []);
console.log(
  "PASS: two-browser create/Socket.IO alert/accept/status sync, nearest match details, donor search/filter, inventory sync, mobile layouts and no browser errors.",
);
await browser.close();
