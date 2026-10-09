import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { smsSegments } from "../../src/lib/sms";

// The demo loop from docs/SPEC.md section 12, one test.step per step so a
// failure names the step that broke. Copy, names and routes come from
// design/screens. The app runs with MOCK_AI=1 on a freshly seeded database,
// see playwright.config.ts, so the totals before the loop are the seed totals.

const seed = JSON.parse(readFileSync("seed/simulation.json", "utf8")) as {
  _expected_totals: { houses: number; totally: number };
  settings: { team_pin: string; staff_pin: string };
  responders: { name: string }[];
};
const before = seed._expected_totals;
const responderName = seed.responders[0].name;
const FIXTURES = ["tests/e2e/fixtures/front.png", "tests/e2e/fixtures/roof.png"];
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };

/** Buttons are links or buttons depending on the screen, so match either. */
const action = (page: Page, name: string | RegExp) =>
  page.getByRole("link", { name, exact: typeof name === "string" }).or(
    page.getByRole("button", { name, exact: typeof name === "string" }),
  );

/** Steps a counter on the check screen to the target from wherever it starts. */
async function setCounter(page: Page, label: string, target: number) {
  const value = page.getByRole("group", { name: label, exact: true }).locator("output");
  for (let guard = 0; guard < 100; guard++) {
    const now = Number(await value.innerText());
    if (now === target) return;
    await page.getByRole("button", { name: `${now < target ? "More" : "Fewer"}, ${label}`, exact: true }).click();
  }
  throw new Error(`${label} never reached ${target}`);
}

const houseCount = (page: Page) => page.getByText(/^\s*\d+\s*houses checked\s*$/);
const totallyCount = (page: Page) => page.getByText(/^\s*\d+\s*totally\s*$/);
const numberIn = async (text: string | null) => Number((text ?? "").replace(/\D/g, ""));

test("demo loop: report, visit, confirm, totals, status, SMS", async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const family = await (await browser.newContext({ baseURL, viewport: PHONE })).newPage();
  const responder = await (await browser.newContext({ baseURL, viewport: PHONE, permissions: ["microphone"] })).newPage();
  const staffContext = await browser.newContext({ baseURL, viewport: LAPTOP });
  const staff = await staffContext.newPage();

  let code = "";

  await test.step("0. Staff sign in, and the hub starts on the seed totals", async () => {
    await staff.goto("/hub");
    await expect(staff).toHaveURL(/\/hub\/lock/);
    await staff.getByLabel("Staff PIN").fill(seed.settings.staff_pin);
    await action(staff, "Unlock").click();
    await expect(staff.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(houseCount(staff)).toHaveText(new RegExp(`^\\s*${before.houses}\\s*houses checked\\s*$`));
    await expect(totallyCount(staff)).toHaveText(new RegExp(`^\\s*${before.totally}\\s*totally\\s*$`));
  });

  await test.step("1. Family sends a report and gets a 4 character code", async () => {
    await family.goto("/");
    await action(family, "Report my household").click();

    // Whose household
    await expect(family.getByRole("heading", { name: "Whose household?" })).toBeVisible();
    await family.getByLabel("Purok").fill("Purok 3");
    await action(family, "Continue").click();

    // Voice note, ready. MOCK_AI has no microphone to record, so type instead.
    await action(family, "Type instead").click();
    await expect(family.getByRole("heading", { name: "Tell us what happened" })).toBeVisible();
    await family
      .getByLabel("What happened")
      .fill("Five of us live here. My son hurt his foot. The roof is gone. We need water and a tarp.");
    await action(family, "Continue").click();

    // Check your report
    // The typed note gives no head of household and a report cannot be sent without one.
    await expect(family.getByRole("heading", { name: "Check your report" })).toBeVisible();
    await family.getByRole("button", { name: /Head of household/ }).click();
    await family.getByRole("textbox", { name: "Head of household" }).fill("Ocampo household");
    await family.getByRole("button", { name: "Save" }).click();
    await action(family, "Continue").click();

    // Before you send
    await expect(family.getByRole("heading", { name: "Before you send" })).toBeVisible();
    await action(family, "Agree and send").click();

    // Report sent
    await expect(family.getByRole("heading", { name: "Report sent" })).toBeVisible();
    const shown = family.getByRole("region", { name: "Your report code" }).getByText(/^[A-HJ-NP-Z2-9]{4}$/);
    await expect(shown).toBeVisible();
    code = (await shown.innerText()).trim();
  });

  await test.step("2. The report shows on the responder's To visit list", async () => {
    await responder.goto("/r");
    await expect(responder).toHaveURL(/\/r\/sign-in/);

    await responder.getByRole("combobox", { name: "Name" }).click();
    await responder.getByRole("option", { name: responderName }).click();
    for (const digit of seed.settings.team_pin) {
      await responder.getByRole("button", { name: digit, exact: true }).click();
    }
    await action(responder, "Unlock").click();

    await expect(responder.getByRole("heading", { name: "To visit" })).toBeVisible();
    const row = responder.locator(`a[href$="/r/reports/${code}"]`);
    await expect(row).toBeVisible();
    await row.click();
    await expect(responder.getByRole("heading", { name: /household/ })).toBeVisible();
  });

  await test.step("3. The responder captures photos and a note, then confirms the AI draft", async () => {
    await action(responder, "Start assessment").click();
    await expect(responder.getByRole("heading", { name: "Assess the house" })).toBeVisible();

    const picker = responder.locator('input[type="file"]');
    for (const file of FIXTURES) await picker.first().setInputFiles(file);
    await expect(responder.getByText("2/3")).toBeVisible();
    // The note is a recording. Chromium runs with a fake microphone, see playwright.config.ts.
    await responder.getByRole("button", { name: "Record a note" }).click();
    // The Stop button shows the elapsed time, so wait for the first second to pass.
    await expect(responder.getByRole("button", { name: /^Stop, 0:0[1-9]/ })).toBeVisible();
    await responder.getByRole("button", { name: /^Stop/ }).click();
    await expect(responder.getByRole("button", { name: "Play your note" })).toBeVisible();
    await action(responder, "Send to hub").click();

    // Hub drafting, MOCK_AI answers from seed/ai-fixtures.json
    await expect(responder.getByRole("heading", { name: "Drafting the entry" })).toBeVisible();
    await action(responder, "Open draft").click();

    // Check the draft: the photo fixture is a totally damaged house
    await expect(responder.getByText("Check the draft")).toBeVisible();
    await expect(responder.getByText("Most of the roof is gone and two back walls collapsed.")).toBeVisible();
    await expect(responder.getByRole("radio", { name: "Totally damaged" })).toBeChecked();
    // The photos say nothing about who lives there, so the responder counts. A hurt
    // count that differs from the family report sends the entry to review and out of the totals.
    // They are set to the report's numbers from any starting value, 0 now or prefilled later.
    await setCounter(responder, "People", 5);
    await setCounter(responder, "Hurt", 1);
    await expect(responder.getByText("Matches report")).toBeVisible();
    await action(responder, "Confirm entry").click();

    await expect(responder.getByRole("heading", { name: "Entry confirmed" })).toBeVisible();
  });

  await test.step("4. The hub totals change on the hub overview after staff sign in", async () => {
    await staff.reload();
    await expect(staff.getByRole("heading", { name: "Overview" })).toBeVisible();
    // Only the confirmed entry counts, the family report on its own did not.
    await expect
      .poll(async () => numberIn(await houseCount(staff).textContent()), { message: "houses checked" })
      .toBe(before.houses + 1);
    await expect
      .poll(async () => numberIn(await totallyCount(staff).textContent()), { message: "totally damaged" })
      .toBe(before.totally + 1);
  });

  await test.step("5. The family status by code shows the confirmed class", async () => {
    await family.goto("/status");
    await family.getByLabel("Report code").fill(code);
    await action(family, "Check").click();

    await expect(family.getByRole("heading", { name: "Totally damaged" })).toBeVisible();
    await expect(family.getByText(`Confirmed by ${responderName}`)).toBeVisible();
  });

  await test.step("6. The situation report SMS text fits in 2 texts", async () => {
    await staff.goto("/hub");
    await action(staff, "Make report").click();
    await expect(staff).toHaveURL(/\/hub\/reports/);
    await action(staff, "Create report").click();

    const sms = await staff.getByRole("textbox", { name: "SMS summary" }).inputValue();
    expect(sms).toContain(`${before.houses + 1} houses checked, ${before.totally + 1} totally`);
    // Up to 2 x 153 GSM-7 characters, or 2 x 67 with a character outside it.
    expect(smsSegments(sms), `SMS is ${sms.length} characters:\n${sms}`).toBeLessThanOrEqual(2);
  });
});
