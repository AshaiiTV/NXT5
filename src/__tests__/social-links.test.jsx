import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getSocialLinks } from "../app/social-links.js";
import { isAdminPath, isAppPath, isKnownPath } from "../app/routing.js";
import SocialPage from "../pages/public/SocialPage.jsx";

describe("Social links and integration routes", () => {
  it("keeps the known Discord link and omits unset accounts", () => {
    expect(getSocialLinks({})).toEqual([expect.objectContaining({ id: "discord", href: "https://discord.gg/esPcQAeNWu" })]);
  });
  it("rejects scripts, lookalike domains and embedded credentials", () => {
    const links = getSocialLinks({
      VITE_SOCIAL_INSTAGRAM_URL: "https://instagram.com.evil.test/nxt5",
      VITE_SOCIAL_YOUTUBE_URL: "javascript:alert(1)",
      VITE_SOCIAL_X_URL: "https://secret@x.com/nxt5",
      VITE_SOCIAL_TWITCH_URL: "https://www.twitch.tv/nxt5",
    });
    expect(links.map((link) => link.id)).toEqual(["discord", "twitch"]);
  });
  it("renders external links with a new-tab indication and opener protection", () => {
    const html = renderToStaticMarkup(<SocialPage />);
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("nouvel onglet");
    expect(html).toContain('href="/reseaux"');
  });
  it("exposes social routes publicly while keeping integrations private and admin-only", () => {
    expect(isKnownPath("/reseaux")).toBe(true);
    expect(isAppPath("/reseaux")).toBe(false);
    expect(isKnownPath("/admin/integrations")).toBe(true);
    expect(isAppPath("/admin/integrations")).toBe(true);
    expect(isAdminPath("/admin/integrations")).toBe(true);
  });
});
