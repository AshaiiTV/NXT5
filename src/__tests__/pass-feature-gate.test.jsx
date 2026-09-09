import React, { useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import PassFeatureGate, { PassFeaturePreview } from "../components/subscriptions/PassFeatureGate.jsx";
import * as passAccess from "../app/pass-access.js";

const cleanups = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

function render(element) {
  let renderer;
  act(() => { renderer = TestRenderer.create(element); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}

describe("prepared subscription gate", () => {
  it("preserves a working tool and its state when trial access is absent before launch", () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function Tool() {
      const [imports, setImports] = useState(10);
      useEffect(() => { mounted(); return unmounted; }, []);
      return <button onClick={() => setImports((count) => count + 1)}>Imports : {imports}</button>;
    }
    const renderer = render(<PassFeatureGate feature="imports" hasActiveTrial><Tool /></PassFeatureGate>);
    act(() => renderer.root.findByType("button").props.onClick());
    act(() => renderer.update(<PassFeatureGate feature="imports" hasActiveTrial={false} hasTeamPass={false}><Tool /></PassFeatureGate>));
    act(() => renderer.root.findByType("button").props.onClick());

    expect(renderer.toJSON()).toMatchObject({ type: "button", children: ["Imports : ", "12"] });
    expect(renderer.root.findAllByType(PassFeaturePreview)).toHaveLength(0);
    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
  });

  it.each(["workspace", "reviews", "exports", "trends", "compositions", "champion_pool", "planning"])("does not place an overlay or subscription action over %s today", (feature) => {
    const useTool = vi.fn();
    const subscribe = vi.fn();
    const renderer = render(<PassFeatureGate feature={feature} onSubscribe={subscribe}><button onClick={useTool}>Utiliser l’outil</button></PassFeatureGate>);
    expect(renderer.toJSON()).toMatchObject({ type: "button", children: ["Utiliser l’outil"] });
    act(() => renderer.root.findByType("button").props.onClick());
    expect(useTool).toHaveBeenCalledOnce();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("does not mount protected tools if a future server-backed policy denies access", () => {
    vi.spyOn(passAccess, "getPassFeatureAccess").mockReturnValue({ allowed: false, requiresPass: true, reason: "pass_required" });
    const readPrivateData = vi.fn();
    const subscribe = vi.fn();
    function PrivateTool() {
      readPrivateData();
      return <button>Exporter les données privées du roster</button>;
    }
    const renderer = render(<PassFeatureGate feature="reviews" onSubscribe={subscribe}><PrivateTool /></PassFeatureGate>);
    expect(readPrivateData).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("données privées");
    expect(renderer.root.findAllByType(PassFeaturePreview)).toHaveLength(1);
    const buttons = renderer.root.findAllByType("button");
    expect(buttons).toHaveLength(1);
    act(() => buttons[0].props.onClick());
    expect(subscribe).toHaveBeenCalledOnce();
  });

  it("can display the isolated preview without changing the access policy", () => {
    const subscribe = vi.fn();
    const renderer = render(<PassFeaturePreview feature="champion_pool" onSubscribe={subscribe} />);
    expect(JSON.stringify(renderer.toJSON())).toContain("Champion Pool");
    act(() => renderer.root.findByType("button").props.onClick());
    expect(subscribe).toHaveBeenCalledOnce();
    expect(passAccess.getPassFeatureAccess("champion_pool")).toMatchObject({ allowed: true, requiresPass: false });
  });
});
