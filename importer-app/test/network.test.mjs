import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { EventEmitter } from "node:events";
import {
  fetchJson,
  lcuRequest,
  parseLockfile,
  createChampionCatalog,
  lockfileCandidates,
} from "../src/network.js";

async function server(t, handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        instance.closeAllConnections();
        instance.close(resolve);
      }),
  );
  return `http://127.0.0.1:${instance.address().port}`;
}

test("remote request handles real JSON, invalid JSON and byte bounds", async (t) => {
  const url = await server(t, (request, response) => {
    if (request.url === "/bad") {
      response.end("not json");
      return;
    }
    if (request.url === "/large") {
      response.end(JSON.stringify({ data: "x".repeat(200) }));
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end('{"ok":true}');
  });
  assert.deepEqual((await fetchJson(url)).payload, { ok: true });
  await assert.rejects(fetchJson(`${url}/bad`), /JSON invalide/);
  await assert.rejects(
    fetchJson(`${url}/large`, { maxBytes: 20 }),
    /volumineuse/,
  );
});

test("hard deadline stops an otherwise active streamed response", async (t) => {
  const url = await server(t, (_request, response) => {
    response.write('{"data":"');
    const timer = setInterval(() => response.write("x"), 10);
    response.on("close", () => clearInterval(timer));
  });
  const start = Date.now();
  await assert.rejects(fetchJson(url, { timeoutMs: 80 }), /pas répondu/);
  assert.ok(Date.now() - start < 1500);
});

test("user cancellation is distinguished from remote timeout", async (t) => {
  const url = await server(t, () => {});
  const controller = new AbortController();
  const pending = fetchJson(url, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("lockfile restricts credentials to a valid TLS loopback port", () => {
  assert.deepEqual(parseLockfile("LeagueClient:12:54321:password:https"), {
    port: 54321,
    password: "password",
    protocol: "https",
  });
  for (const value of [
    "League:1:0:password:https",
    "League:1:65536:password:https",
    "League:1:123:password:http",
    "League:1:123::https",
  ])
    assert.throws(() => parseLockfile(value));
  assert.ok(
    lockfileCandidates("/custom/League.app").includes(
      path.join("/custom/League.app", "Contents", "LoL", "lockfile"),
    ),
  );
});

function fakeRequest({
  body = '{"ok":true}',
  status = 200,
  neverEnds = false,
} = {}) {
  let options;
  const requestImpl = (requestOptions, onResponse) => {
    options = requestOptions;
    const request = new EventEmitter();
    request.destroy = () => {};
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = status;
      response.setEncoding = () => {};
      response.destroy = () => {};
      queueMicrotask(() => {
        onResponse(response);
        response.emit("data", body);
        if (!neverEnds) response.emit("end");
      });
    };
    return request;
  };
  return { requestImpl, options: () => options };
}

test("local requests stay on loopback, parse valid responses and reject incomplete/error bodies", async () => {
  const lock = { port: 54321, password: "local-only" };
  const good = fakeRequest();
  assert.deepEqual(
    await lcuRequest(lock, "/lol-match-history/v1/games/123456", good),
    { ok: true },
  );
  assert.equal(good.options().hostname, "127.0.0.1");
  assert.equal(good.options().rejectUnauthorized, false);
  await assert.rejects(
    lcuRequest(lock, "/match", fakeRequest({ status: 404 })),
    /404/,
  );
  await assert.rejects(
    lcuRequest(lock, "/match", fakeRequest({ body: "{bad" })),
    /invalides/,
  );
  await assert.rejects(
    lcuRequest(lock, "/match", {
      ...fakeRequest({ neverEnds: true }),
      timeoutMs: 20,
    }),
    /ne répond pas/,
  );
  await assert.rejects(
    lcuRequest(lock, "/match", { ...fakeRequest(), maxBytes: 2 }),
    /volumineuse/,
  );
});

test("local cancellation destroys a pending request without waiting for its deadline", async () => {
  const controller = new AbortController();
  const pending = lcuRequest({ port: 1234, password: "pw" }, "/match", {
    ...fakeRequest({ neverEnds: true }),
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("ten champion lookups share one versions request and one catalog request", async () => {
  const calls = [];
  const catalog = createChampionCatalog(async (url) => {
    calls.push(url);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      response: { ok: true },
      payload: url.endsWith("versions.json")
        ? ["16.1.1"]
        : { data: { Annie: { key: "1", name: "Annie" } } },
    };
  });
  assert.deepEqual(
    await Promise.all(Array.from({ length: 10 }, () => catalog.name(1))),
    Array(10).fill("Annie"),
  );
  assert.equal(calls.length, 2);
  assert.equal(await catalog.name(999), "Champion 999");
  assert.equal(calls.length, 2);
});

test("champion names gracefully fall back offline without retry storms", async () => {
  let calls = 0;
  const catalog = createChampionCatalog(async () => {
    calls++;
    throw new Error("Offline");
  });
  const names = await Promise.all(
    Array.from({ length: 10 }, (_, index) => catalog.name(index + 1)),
  );
  assert.equal(names[0], "Champion 1");
  assert.equal(names[9], "Champion 10");
  assert.equal(calls, 1);
  assert.equal(await catalog.name(11), "Champion 11");
  assert.equal(calls, 1);
});
