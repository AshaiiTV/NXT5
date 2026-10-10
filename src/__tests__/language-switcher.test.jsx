import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import LanguageSwitcher from "../i18n/LanguageSwitcher.jsx";
import * as locale from "../i18n/locale.js";
import { getLanguage, LANGUAGE_STORAGE_KEY, setLanguage } from "../i18n/locale.js";
import { useLanguage } from "../i18n/useLanguage.js";
import { Topbar } from "../components/layout/AppChrome.jsx";
import { SiteHeader } from "../pages/public/PublicPages.jsx";

let renderer;
afterEach(async () => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  vi.restoreAllMocks();
  await setLanguage("fr");
  vi.unstubAllGlobals();
});

describe("site language control", () => {
  it("offers all three languages by their own name through a native keyboard/touch select", () => {
    act(() => { renderer = TestRenderer.create(<LanguageSwitcher />); });
    const select = renderer.root.findByType("select");
    expect(select.props.value).toBe("fr");
    expect(select.props["aria-label"]).toBe("Langue du site");
    expect(select.props.onKeyDown).toBeUndefined();
    expect(select.props.tabIndex).not.toBe(-1);
    expect(renderer.root.findAllByType("option").map(({ props, children }) => [props.value, props.lang, children.join("")])).toEqual([
      ["fr", "fr", "Français"], ["en", "en", "English"], ["es", "es", "Español"],
    ]);
  });

  it("changes and remembers the language without navigation or losing a form draft", async () => {
    const setItem = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem }, location: { reload } });
    function Draft() {
      const language = useLanguage();
      const [value, setValue] = useState("");
      return <form data-language={language}><input value={value} onChange={(event) => setValue(event.target.value)} /><LanguageSwitcher /></form>;
    }
    act(() => { renderer = TestRenderer.create(<Draft />); });
    act(() => renderer.root.findByType("input").props.onChange({ target: { value: "Un débrief encore en cours" } }));
    for (const [language, label] of [["en", "Site language"], ["es", "Idioma del sitio"], ["fr", "Langue du site"]]) {
      await act(async () => { await renderer.root.findByType("select").props.onChange({ target: { value: language } }); });
      expect(getLanguage()).toBe(language);
      expect(renderer.root.findByType("form").props["data-language"]).toBe(language);
      expect(renderer.root.findByType("select").props["aria-label"]).toBe(label);
      expect(renderer.root.findByType("input").props.value).toBe("Un débrief encore en cours");
      expect(setItem).toHaveBeenLastCalledWith(LANGUAGE_STORAGE_KEY, language);
    }
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the current selection and exposes its busy state until loading succeeds", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    const commitLanguage = locale.setLanguage;
    let completeLoading;
    const loading = new Promise((resolve) => { completeLoading = resolve; });
    vi.spyOn(locale, "setLanguage").mockImplementation((language) => loading.then(() => commitLanguage(language)));
    act(() => { renderer = TestRenderer.create(<LanguageSwitcher />); });
    let change;
    act(() => { change = renderer.root.findByType("select").props.onChange({ target: { value: "en" } }); });

    expect(renderer.root.findByType("label").props["aria-busy"]).toBe(true);
    expect(renderer.root.findByType("select").props.disabled).toBe(true);
    expect(renderer.root.findByType("select").props.value).toBe("fr");
    expect(setItem).not.toHaveBeenCalled();
    await act(async () => { completeLoading(); await change; });

    expect(renderer.root.findByType("label").props["aria-busy"]).toBe(false);
    expect(renderer.root.findByType("select").props.disabled).toBe(false);
    expect(renderer.root.findByType("select").props.value).toBe("en");
    expect(setItem).toHaveBeenLastCalledWith(LANGUAGE_STORAGE_KEY, "en");
  });

  it("announces a loading failure without changing the language and allows retry", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    const commitLanguage = locale.setLanguage;
    vi.spyOn(locale, "setLanguage").mockRejectedValueOnce(new Error("Catalogue unavailable")).mockImplementation(commitLanguage);
    act(() => { renderer = TestRenderer.create(<LanguageSwitcher />); });
    await act(async () => { await renderer.root.findByType("select").props.onChange({ target: { value: "es" } }); });

    expect(getLanguage()).toBe("fr");
    expect(setItem).not.toHaveBeenCalled();
    expect(renderer.root.findByType("select").props.disabled).toBe(false);
    expect(renderer.root.findByType("label").props["aria-busy"]).toBe(false);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toBe("Impossible de charger cette langue. Réessaie.");
    await act(async () => { await renderer.root.findByType("select").props.onChange({ target: { value: "es" } }); });

    expect(getLanguage()).toBe("es");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(renderer.root.findByType("select").props["aria-label"]).toBe("Idioma del sitio");
    expect(setItem).toHaveBeenLastCalledWith(LANGUAGE_STORAGE_KEY, "es");
  });

  it("is present in the public header even without extra navigation", () => {
    act(() => { renderer = TestRenderer.create(<SiteHeader />); });
    expect(renderer.root.findAllByType(LanguageSwitcher)).toHaveLength(1);
  });

  it.each(["home", "admin", "access-requests", "account-subscriptions"])("is present in the %s workspace header", (active) => {
    act(() => { renderer = TestRenderer.create(<Topbar active={active} teams={[]} setOpen={vi.fn()} />); });
    expect(renderer.root.findAllByType(LanguageSwitcher)).toHaveLength(1);
  });
});
