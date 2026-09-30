import React from "react";
import { existsSync } from "node:fs";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { OBJECTIVE_ICON_SOURCES, ObjectivePictogram } from "../pages/workspace/GameWorkspace.jsx";

// Régression : le héraut n’avait pas le repli local des autres objectifs.
describe("local objective icon fallbacks", () => {
  it.each(["dragon", "baron", "grub", "herald"])("uses the bundled %s icon right after the first remote source", (type) => {
    const local = `/assets/objectives/${type}.png`;
    expect(OBJECTIVE_ICON_SOURCES[type][1]).toBe(local);
    expect(existsSync(new URL(`../../public${local}`, import.meta.url))).toBe(true);
  });

  it("shows the local herald when the remote icon fails", () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<ObjectivePictogram type="herald" />); });
    const img = () => renderer.root.findByType("img");
    expect(decodeURIComponent(img().props.src)).toContain("raw.communitydragon.org");
    act(() => img().props.onError());
    expect(img().props.src).toBe("/assets/objectives/herald.png");
    act(() => renderer.unmount());
  });
});
