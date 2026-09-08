import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createSubscriptionForm, defaultSubscriptionEndDate, getSubscriptionPresentation, localDateInput, subscriptionDateToISO, subscriptionEndDateInput, subscriptionFormDates, subscriptionPeriodLabel } from "../app/subscriptions.js";

describe("manual subscription presentation and calendar dates", () => {
  it.each([
    ["none", "Sans abonnement"], ["active", "Actif"], ["scheduled", "À venir"], ["expired", "Expiré"], ["revoked", "Retiré"],
  ])("preserves the assigned plan and presents status %s", (status, statusLabel) => {
    expect(getSubscriptionPresentation({ planCode: "structure", effectivePlanCode: "free", status })).toMatchObject({ label: "Pass Structure", statusLabel });
  });

  it("shows free or absent assignments without a paid period", () => {
    expect(getSubscriptionPresentation(null)).toEqual({ label: "Découverte", statusLabel: "Sans abonnement", tone: "slate" });
    expect(getSubscriptionPresentation({ planCode: "free", status: "active" })).toMatchObject({ label: "Découverte", statusLabel: "Actif" });
    expect(subscriptionPeriodLabel({ planCode: "free", startsAt: null })).toBe("Aucune période payante");
    expect(subscriptionFormDates({ planCode: "free", startDate: "invalid", endDate: "invalid" })).toEqual({ startsAt: null, endsAt: null });
  });

  it.each([
    ["2026-01-31", "team_monthly", "2026-02-27"],
    ["2024-01-31", "team_monthly", "2024-02-28"],
    ["2026-08-31", "team_season", "2027-02-27"],
    ["2026-09-08", "team_season", "2027-03-07"],
    ["2026-12-20", "structure", "2027-01-19"],
    ["2026-05-31", "structure", "2026-06-29"],
  ])("defaults %s / %s to the last included day %s", (start, plan, expected) => {
    expect(defaultSubscriptionEndDate(start, plan)).toBe(expected);
  });

  it.each(["", "2026-02-29", "2026-02-31", "2026-13-01", "2026-00-02", "2026-1-2", "not-a-date", "0000-01-01"])("rejects the invalid date %s without rolling into another month", (value) => {
    expect(subscriptionDateToISO(value)).toBeNull();
    expect(defaultSubscriptionEndDate(value, "team_monthly")).toBe("");
  });

  it("accepts a one-day paid assignment and validates finite ranges", () => {
    const form = { planCode: "team_monthly", startDate: "2026-09-08", endDate: "2026-09-08", noEndDate: false };
    expect(subscriptionFormDates(form)).toEqual({ startsAt: subscriptionDateToISO("2026-09-08"), endsAt: subscriptionDateToISO("2026-09-08", true) });
    expect(() => subscriptionFormDates({ ...form, endDate: "2026-09-07" })).toThrow("égale ou postérieure");
    expect(() => subscriptionFormDates({ ...form, endDate: "" })).toThrow("dates valides");
    expect(subscriptionFormDates({ ...form, noEndDate: true, endDate: "" }).endsAt).toBeNull();
  });

  it("round-trips exclusive ends and preserves an explicit indefinite assignment", () => {
    const startsAt = subscriptionDateToISO("2026-09-08");
    const endsAt = subscriptionDateToISO("2026-09-30", true);
    expect(subscriptionEndDateInput(endsAt)).toBe("2026-09-30");
    expect(createSubscriptionForm({ planCode: "team_monthly", startsAt, endsAt, note: "Accord staff" })).toMatchObject({ startDate: "2026-09-08", endDate: "2026-09-30", noEndDate: false, note: "Accord staff" });
    expect(createSubscriptionForm({ planCode: "team_monthly", startsAt, endsAt: null })).toMatchObject({ startDate: "2026-09-08", noEndDate: true });
    expect(createSubscriptionForm(null, new Date(2026, 8, 8))).toMatchObject({ planCode: "free", startDate: "2026-09-08", noEndDate: false });
    expect(localDateInput("invalid")).toBe("");
    expect(subscriptionEndDateInput("invalid")).toBe("");
  });

  it("uses calendar midnights across both daylight-saving transitions", () => {
    const moduleUrl = new URL("../app/subscriptions.js", import.meta.url).href;
    const script = `import { subscriptionDateToISO, subscriptionEndDateInput } from ${JSON.stringify(moduleUrl)};
      process.stdout.write(JSON.stringify(['2026-03-29', '2026-10-25'].map(value => {
        const start = subscriptionDateToISO(value); const end = subscriptionDateToISO(value, true);
        return {start, end, included: subscriptionEndDateInput(end), hours: (Date.parse(end) - Date.parse(start)) / 3600000};
      })));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, TZ: "Europe/Paris" } });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      { start: "2026-03-28T23:00:00.000Z", end: "2026-03-29T22:00:00.000Z", included: "2026-03-29", hours: 23 },
      { start: "2026-10-24T22:00:00.000Z", end: "2026-10-25T23:00:00.000Z", included: "2026-10-25", hours: 25 },
    ]);
  });
});
