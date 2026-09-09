import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_PLANS, createSubscriptionForm, defaultSubscriptionEndDate, getSubscriptionPlanLabel, getSubscriptionPresentation, localDateInput, subscriptionDateToISO, subscriptionEndDateInput, subscriptionFormDates, subscriptionPeriodLabel } from "../app/subscriptions.js";

describe("manual subscription presentation and calendar dates", () => {
  it("offers two current plans and retains the old labels only for audit history", () => {
    expect(SUBSCRIPTION_PLANS.map((plan) => plan.code)).toEqual(["free", "team_monthly"]);
    expect(getSubscriptionPlanLabel("team_season")).toBe("Pass Saison (ancienne offre)");
    expect(getSubscriptionPlanLabel("structure")).toBe("Pass Structure (ancienne offre)");
    expect(() => subscriptionFormDates({ planCode: "structure" })).toThrow("Découverte ou Pass Équipe");
  });

  it("starts a trial only on explicit selection and fixes its period to fourteen full days", () => {
    const form = createSubscriptionForm({ planCode: "free", status: "pending" }, new Date(2026, 8, 9));
    expect(form.startTrial).toBe(false);
    expect(subscriptionFormDates(form)).toEqual({ startsAt: null, endsAt: null });
    const dates = subscriptionFormDates({ ...form, startTrial: true, endDate: "2099-01-01", noEndDate: true });
    expect(dates.startsAt).toBe(subscriptionDateToISO("2026-09-09"));
    expect(Date.parse(dates.endsAt) - Date.parse(dates.startsAt)).toBe(14 * 86400000);
  });

  it("preserves exact historical instants when editing only a note or a migrated Pass", () => {
    const startsAt = "2026-09-09T14:23:45.000Z";
    const endsAt = "2026-09-23T14:23:45.000Z";
    for (const planCode of ["free", "team_monthly", "team_season", "structure"]) {
      const form = createSubscriptionForm({ planCode, startsAt, endsAt, note: "Ancien accord" });
      expect(subscriptionFormDates({ ...form, note: "Note modifiée" })).toEqual({ startsAt, endsAt });
      if (planCode !== "free") expect(form.planCode).toBe("team_monthly");
    }
  });
  it.each([
    ["none", "Sans abonnement"], ["active", "Actif"], ["scheduled", "À venir"], ["expired", "Expiré"], ["revoked", "Retiré"],
  ])("preserves the assigned plan and presents status %s", (status, statusLabel) => {
    expect(getSubscriptionPresentation({ planCode: "team_monthly", effectivePlanCode: null, status })).toMatchObject({ label: status === "none" ? "Sans abonnement" : "Pass Équipe", statusLabel });
  });

  it("distinguishes a prepared trial from no subscription", () => {
    expect(getSubscriptionPresentation(null)).toEqual({ label: "Sans abonnement", statusLabel: "Sans abonnement", tone: "slate" });
    expect(getSubscriptionPresentation({ planCode: "free", status: "pending" })).toMatchObject({ label: "Découverte", statusLabel: "Essai non démarré" });
    expect(subscriptionPeriodLabel({ planCode: "free", startsAt: null })).toBe("14 jours d’accès complet · essai non démarré");
    expect(subscriptionFormDates({ planCode: "free", startDate: "invalid", endDate: "invalid" })).toEqual({ startsAt: null, endsAt: null });
  });

  it.each([
    ["2026-01-31", "team_monthly", "2026-02-27"],
    ["2024-01-31", "team_monthly", "2024-02-28"],
    ["2026-09-08", "free", "2026-09-21"],
    ["2026-12-20", "team_monthly", "2027-01-19"],
    ["2026-05-31", "team_monthly", "2026-06-29"],
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
