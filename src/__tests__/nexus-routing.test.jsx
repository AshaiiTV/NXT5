import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppRouter from "../AppRouter.jsx";
import { AppLoadingProvider } from "../components/loading/AppLoadingProvider.jsx";
import { apiFetch } from "../api/client.js";
import { createSeoDocument } from "./helpers/seo-document.js";

const modules=vi.hoisted(()=>({workspace:vi.fn()}));
vi.mock("../api/client.js",()=>({apiFetch:vi.fn(),API_BASE:"/.netlify/functions"}));
vi.mock("../app/performance.js",()=>({configurePerformanceMode:vi.fn(),PERFORMANCE_MODE_STORAGE_KEY:"performance"}));
vi.mock("../components/privacy/CookieConsent.jsx",()=>({default:()=>null}));
vi.mock("../components/loading/AppLoadingScreen.jsx",()=>({default:({phase})=><aside data-loader={phase}/> }));
vi.mock("../AppContent.jsx",()=>{modules.workspace();return {default:()=> <main data-private/>};});
vi.mock("../pages/nexus/NexusRisingPage.jsx",()=>({default:({user})=><main data-nexus data-user={user?.id || "guest"}/> }));

let renderer;
afterEach(()=>{act(()=>renderer?.unmount());renderer=undefined;vi.clearAllMocks();vi.unstubAllGlobals();});
async function open(path="/nexus-rising") {
  vi.stubGlobal("window",{location:new URL(path,"https://nxt5.test"),history:{pushState:vi.fn(),replaceState:vi.fn()},scrollTo:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),localStorage:{getItem:vi.fn()}});
  vi.stubGlobal("document",createSeoDocument());
  await act(async()=>{renderer=TestRenderer.create(<AppLoadingProvider><AppRouter/></AppLoadingProvider>);});
  await act(async()=>{await vi.dynamicImportSettled();});
}
function expectPublic(user="guest") {
  expect(renderer.root.findByProps({"data-nexus":true}).props["data-user"]).toBe(user);
  expect(modules.workspace).not.toHaveBeenCalled();
  expect(renderer.root.findAll(node=>node.props["data-loader"])).toHaveLength(0);
  expect(window.history.pushState).not.toHaveBeenCalled();
  expect(window.history.replaceState).not.toHaveBeenCalled();
  expect(document.title).toBe("Nexus Rising — NXT5");
}
describe("standalone Nexus route integration",()=>{
  it.each([null,{id:"member"},{id:"staff",is_platform_admin:true}])("preserves guest access and optional account context (%j)",async user=>{
    apiFetch.mockResolvedValueOnce({user});
    await open("/nexus-rising/?invite=irrelevant");
    expectPublic(user?.id);
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("auth-me");
  });
  it("renders while the session is pending and stays public when authentication completes",async()=>{
    let finish;
    apiFetch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    await open();expectPublic();
    await act(async()=>finish({user:{id:"member"}}));
    expectPublic("member");
  });
  it("keeps the portal available when session lookup fails",async()=>{
    apiFetch.mockRejectedValueOnce(new Error("Session indisponible"));
    await open();expectPublic();
  });
});
