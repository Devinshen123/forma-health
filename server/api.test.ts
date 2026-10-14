import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import {
  emptyState,
  type AppState,
  type Meal,
  type PlanVersion,
  type Sleep,
  type Suggestion,
} from "../src/types";

const PASSWORD = "a local test password 123";
const ORIGIN = "http://127.0.0.1:5173";
const NOW = "2026-10-13T18:00:00.000Z";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAt8AAAAASUVORK5CYII=";
const meal = (): Meal => ({
  id: randomUUID(),
  date: "2026-10-13",
  name: "Lunch",
  type: "lunch",
  grams: 150,
  referenceGrams: 100,
  kcal: 120,
  protein: 8,
  carbs: 10,
  fat: 4,
  source: "manual",
  createdAt: NOW,
});
const plan = (parentId: string | null = null): PlanVersion => ({
  id: randomUUID(),
  parentId,
  createdAt: NOW,
  reason: "My schedule",
  trainingMinutes: 45,
  trainingDays: 3,
  sleepHours: 8,
  calorieTarget: null,
  proteinTarget: null,
});
const sleep = (): Sleep => ({
  id: randomUUID(),
  date: "2026-10-13",
  start: "2026-10-12T23:00:00-07:00",
  end: "2026-10-13T07:00:00-07:00",
  quality: 4,
  energy: 3,
  source: "manual",
  timezone: "America/Los_Angeles",
  createdAt: NOW,
});
async function harness(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "forma-api-test-"));
  const service = createApp({ dataDir: dir, secureCookies: false, ai: {} });
  const server = service.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolveReady) =>
    server.once("listening", resolveReady),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  // Each page holds its own expected account, independent of the shared browser cookie.
  const accountByCookie = new Map<string, string>();
  t.after(async () => {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    service.close();
    assert.ok(
      resolve(dir).startsWith(resolve(tmpdir()) + "\\") ||
        resolve(dir).startsWith(resolve(tmpdir()) + "/"),
    );
    assert.ok(dir.includes("forma-api-test-"));
    rmSync(dir, { recursive: true, force: true });
  });
  const request = async (
    path: string,
    options: {
      method?: string;
      body?: unknown;
      cookie?: string;
      origin?: string;
      contentType?: string;
      accountHint?: string | null;
    } = {},
  ) => {
    const headers: Record<string, string> = {
      Origin: options.origin ?? ORIGIN,
      "Content-Type": options.contentType ?? "application/json",
    };
    if (options.cookie) headers.Cookie = options.cookie;
    const accountHint =
      options.accountHint === undefined
        ? options.cookie && accountByCookie.get(options.cookie)
        : options.accountHint;
    if (accountHint) headers["X-Forma-Account"] = accountHint;
    const response = await fetch(`${base}/api${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? JSON.parse(bytes.toString())
      : null;
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (cookie && data?.user?.id) accountByCookie.set(cookie, data.user.id);
    return {
      status: response.status,
      data,
      bytes,
      headers: response.headers,
      cookie,
    };
  };
  const register = async (email = `${randomUUID()}@example.com`) => {
    const response = await request("/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, name: "Test user" },
    });
    assert.equal(response.status, 201);
    assert.ok(response.cookie);
    return { cookie: response.cookie, user: response.data.user, email };
  };
  return { request, register, dir, service };
}

test("accounts use salted hashes, normalize email, rotate private sessions and logout", async (t) => {
  const h = await harness(t);
  const bad = await h.request("/auth/register", {
    method: "POST",
    body: { email: "first@example.com", password: "short", name: "User" },
  });
  assert.equal(bad.status, 400);
  const account = await h.register("First@example.com");
  const duplicate = await h.request("/auth/register", {
    method: "POST",
    body: { email: "FIRST@example.com", password: PASSWORD, name: "Other" },
  });
  assert.equal(duplicate.status, 409);
  const me = await h.request("/auth/me", { cookie: account.cookie });
  assert.equal(me.data.user.email, "first@example.com");
  assert.deepEqual(Object.keys(me.data.user).sort(), ["email", "id", "name"]);
  const row = h.service.store.accountByEmail("first@example.com")!;
  assert.equal(row.password_hash.length, 128);
  assert.equal(row.password_salt.length, 32);
  assert.notEqual(row.password_hash, PASSWORD);
  const login = await h.request("/auth/login", {
    method: "POST",
    cookie: account.cookie,
    body: { email: "first@example.com", password: PASSWORD },
  });
  assert.equal(login.status, 200);
  assert.notEqual(login.cookie, account.cookie);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(login.headers.get("set-cookie")!, /SameSite=Strict/);
  assert.equal(
    (await h.request("/state", { cookie: account.cookie })).status,
    401,
  );
  assert.equal(
    (
      await h.request("/auth/login", {
        method: "POST",
        body: { email: "first@example.com", password: "incorrect password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await h.request("/auth/logout", {
        method: "POST",
        cookie: login.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await h.request("/state", { cookie: login.cookie })).status,
    401,
  );
});

test("state is account-scoped and revision compare-and-swap rejects a lost update", async (t) => {
  const h = await harness(t),
    a = await h.register(),
    b = await h.register();
  assert.deepEqual((await h.request("/state", { cookie: a.cookie })).data, {
    state: emptyState(),
    revision: 0,
  });
  const state = emptyState();
  state.meals.push(meal());
  const writes = await Promise.all(
    [1, 2].map(() =>
      h.request("/state", {
        method: "PUT",
        cookie: a.cookie,
        body: { state, revision: 0 },
      }),
    ),
  );
  assert.deepEqual(writes.map((value) => value.status).sort(), [200, 409]);
  assert.equal(
    (await h.request("/state", { cookie: a.cookie })).data.revision,
    1,
  );
  assert.deepEqual(
    (await h.request("/state", { cookie: b.cookie })).data.state,
    emptyState(),
  );
  const exported = await h.request("/export", { cookie: a.cookie });
  assert.equal(exported.data.state.meals[0].name, "Lunch");
  assert.equal(exported.data.user.id, a.user.id);
  assert.ok(!JSON.stringify(exported.data).includes("password_hash"));
});

test("a stale tab cannot read, save, upload, export or delete with another account cookie", async (t) => {
  const h = await harness(t),
    a = await h.register(),
    b = await h.register();
  for (const accountHint of [a.user.id, null]) {
    const staleLogout = await h.request('/auth/logout', { method: 'POST', body: {}, cookie: b.cookie, accountHint });
    assert.equal(staleLogout.status, 401);
    assert.equal(staleLogout.data.code, 'ACCOUNT_CHANGED');
    const stillSignedIn = await h.request('/auth/me', { cookie: b.cookie });
    assert.equal(stillSignedIn.data.user.id, b.user.id);
  }
  const stateA = emptyState();
  stateA.meals = [meal()];
  // Both start at revision 0: a revision check alone would not catch this account switch.
  const blocked = await h.request("/state", {
    method: "PUT",
    cookie: b.cookie,
    accountHint: a.user.id,
    body: { state: stateA, revision: 0 },
  });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.data.code, "ACCOUNT_CHANGED");
  assert.deepEqual((await h.request("/state", { cookie: b.cookie })).data, {
    state: emptyState(),
    revision: 0,
  });
  assert.deepEqual((await h.request("/state", { cookie: a.cookie })).data, {
    state: emptyState(),
    revision: 0,
  });
  for (const path of ["/state", "/export"]) {
    const response = await h.request(path, {
      cookie: b.cookie,
      accountHint: a.user.id,
    });
    assert.equal(response.status, 401);
    assert.equal(response.data.code, "ACCOUNT_CHANGED");
    assert.equal(
      (await h.request(path, { cookie: b.cookie, accountHint: null })).status,
      401,
    );
  }
  const upload = await h.request("/assets", {
    method: "POST",
    cookie: b.cookie,
    accountHint: a.user.id,
    body: { name: "A-meal.png", mime: "image/png", base64: PNG },
  });
  assert.equal(upload.status, 401);
  assert.equal(upload.data.code, "ACCOUNT_CHANGED");
  assert.equal(h.service.store.assets(b.user.id).length, 0);
  const deletion = await h.request("/account", {
    method: "DELETE",
    cookie: b.cookie,
    accountHint: a.user.id,
    body: { password: PASSWORD },
  });
  assert.equal(deletion.status, 401);
  assert.equal(deletion.data.code, "ACCOUNT_CHANGED");
  assert.ok(h.service.store.accountByEmail(b.email));
});

test("strict schemas reject invented AI data, duplicate IDs, impossible dates, macros and sleep spans", async (t) => {
  const h = await harness(t),
    a = await h.register();
  const save = (state: unknown) =>
    h.request("/state", {
      method: "PUT",
      cookie: a.cookie,
      body: { state, revision: 0 },
    });
  let state: AppState = emptyState();
  state.meals = [meal()];
  assert.equal((await save({ ...state, secret: true })).status, 400);
  assert.equal(
    (
      await save({
        ...state,
        meals: [{ ...state.meals[0], source: "ai_estimate" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        meals: [{ ...state.meals[0], date: "2026-02-30" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        meals: [{ ...state.meals[0], referenceGrams: 0 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await save({ ...state, meals: [{ ...state.meals[0], protein: 1000 }] }))
      .status,
    400,
  );
  assert.equal(
    (await save({ ...state, meals: [state.meals[0], state.meals[0]] })).status,
    400,
  );
  state = emptyState();
  state.sleeps = [sleep()];
  assert.equal(
    (
      await save({
        ...state,
        sleeps: [{ ...state.sleeps[0], end: state.sleeps[0].start }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        sleeps: [{ ...state.sleeps[0], start: "2026-10-11T23:00:00-07:00" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        sleeps: [{ ...state.sleeps[0], timezone: "Made/Up" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        sleeps: [{ ...state.sleeps[0], date: "2026-10-12" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        sleeps: [state.sleeps[0], { ...state.sleeps[0], id: randomUUID() }],
      })
    ).status,
    400,
  );
  assert.equal((await save(state)).status, 200);
});

test("private uploads check bytes, ownership and references; record deletion removes its file", async (t) => {
  const h = await harness(t),
    a = await h.register(),
    b = await h.register();
  const wrong = await h.request("/assets", {
    method: "POST",
    cookie: a.cookie,
    body: { name: "fake.pdf", mime: "application/pdf", base64: PNG },
  });
  assert.equal(wrong.status, 400);
  const file = await h.request("/assets", {
    method: "POST",
    cookie: a.cookie,
    body: { name: "../../meal.png", mime: "image/png", base64: PNG },
  });
  assert.equal(file.status, 201);
  assert.ok(!file.data.name.includes("/"));
  const assetPath = join(h.dir, "uploads", a.user.id, file.data.id);
  assert.ok(existsSync(assetPath));
  assert.deepEqual(readFileSync(assetPath), Buffer.from(PNG, "base64"));
  assert.equal(
    (await h.request(`/assets/${file.data.id}`, { cookie: b.cookie })).status,
    404,
  );
  assert.equal((await h.request(`/assets/${file.data.id}`)).status, 401);
  assert.equal(
    (await h.request(`/assets/${file.data.id}`, { cookie: a.cookie })).status,
    200,
  );
  // <img> and download navigation cannot attach a custom account header.
  assert.equal(
    (
      await h.request(`/assets/${file.data.id}`, {
        cookie: a.cookie,
        accountHint: null,
      })
    ).status,
    200,
  );
  const state = emptyState();
  state.meals = [{ ...meal(), assetId: file.data.id }];
  assert.equal(
    (
      await h.request("/state", {
        method: "PUT",
        cookie: b.cookie,
        body: { state, revision: 0 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await h.request("/state", {
        method: "PUT",
        cookie: a.cookie,
        body: { state, revision: 0 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(`/assets/${file.data.id}`, {
        method: "DELETE",
        cookie: a.cookie,
        body: {},
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await h.request("/state", {
        method: "PUT",
        cookie: a.cookie,
        body: { state: emptyState(), revision: 1 },
      })
    ).status,
    200,
  );
  assert.ok(!existsSync(assetPath));
  assert.equal(
    (await h.request(`/assets/${file.data.id}`, { cookie: a.cookie })).status,
    404,
  );
});

test("plan acceptance and undo append immutable accepted and compensating versions", async (t) => {
  const h = await harness(t),
    a = await h.register();
  let revision = 0;
  const save = async (state: AppState) => {
    const response = await h.request("/state", {
      method: "PUT",
      cookie: a.cookie,
      body: { state, revision },
    });
    if (response.status === 200) revision = response.data.revision;
    return response;
  };
  const first = plan();
  let state = {
    ...emptyState(),
    planVersions: [first],
    currentPlanId: first.id,
  };
  assert.equal((await save(state)).status, 200);
  assert.equal(
    (
      await save({
        ...state,
        planVersions: [{ ...first, trainingMinutes: 90 }],
      })
    ).status,
    400,
  );
  const suggestion: Suggestion = {
    id: randomUUID(),
    baseVersionId: first.id,
    createdAt: NOW,
    reason: "My available time changed",
    status: "proposed",
    patch: { trainingMinutes: 30 },
  };
  state = { ...state, suggestions: [suggestion] };
  assert.equal((await save(state)).status, 200);
  const child = { ...plan(first.id), trainingMinutes: 30 };
  const accepted: Suggestion = {
    ...suggestion,
    status: "accepted",
    acceptedVersionId: child.id,
  };
  assert.equal(
    (await save({ ...state, suggestions: [accepted], currentPlanId: child.id }))
      .status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        planVersions: [first, { ...child, trainingMinutes: 40 }],
        suggestions: [accepted],
        currentPlanId: child.id,
      })
    ).status,
    400,
  );
  state = {
    ...state,
    planVersions: [first, child],
    suggestions: [accepted],
    currentPlanId: child.id,
  };
  assert.equal((await save(state)).status, 200);
  assert.equal(
    (await save({ ...state, planVersions: [child, first] })).status,
    400,
  );
  assert.equal(
    (
      await save({
        ...state,
        currentPlanId: first.id,
        suggestions: [{ ...accepted, status: "undone" }],
      })
    ).status,
    400,
  );
  const compensation = {
    ...first,
    id: randomUUID(),
    parentId: child.id,
    reason: "Undo the schedule adjustment",
  };
  state = {
    ...state,
    planVersions: [first, child, compensation],
    currentPlanId: compensation.id,
    suggestions: [{ ...accepted, status: "undone" }],
  };
  assert.equal((await save(state)).status, 200);
  assert.equal(state.planVersions.length, 3);
  assert.equal(
    (
      await save({
        ...state,
        suggestions: [{ ...accepted, status: "accepted" }],
        currentPlanId: child.id,
      })
    ).status,
    400,
  );
  assert.equal((await save({ ...state, planVersions: [first] })).status, 400);
  assert.deepEqual(
    (await h.request("/state", { cookie: a.cookie })).data.state.planVersions,
    [first, child, compensation],
  );
});

test("account deletion requires password and cascades private data, files and all sessions", async (t) => {
  const h = await harness(t),
    a = await h.register(),
    b = await h.register();
  const secondSession = await h.request("/auth/login", {
    method: "POST",
    body: { email: a.email, password: PASSWORD },
  });
  assert.equal(secondSession.status, 200);
  const file = await h.request("/assets", {
    method: "POST",
    cookie: a.cookie,
    body: { name: "meal.png", mime: "image/png", base64: PNG },
  });
  assert.equal(file.status, 201);
  assert.equal(
    (
      await h.request("/account", {
        method: "DELETE",
        cookie: a.cookie,
        body: { password: "wrong" },
      })
    ).status,
    401,
  );
  assert.ok(existsSync(join(h.dir, "uploads", a.user.id)));
  assert.equal(
    (
      await h.request("/account", {
        method: "DELETE",
        cookie: a.cookie,
        body: { password: PASSWORD },
      })
    ).status,
    200,
  );
  assert.ok(!existsSync(join(h.dir, "uploads", a.user.id)));
  assert.equal((await h.request("/state", { cookie: a.cookie })).status, 401);
  assert.equal(
    (await h.request("/state", { cookie: secondSession.cookie })).status,
    401,
  );
  assert.equal(
    (await h.request("/auth/me", { cookie: a.cookie })).data.user,
    null,
  );
  assert.equal(h.service.store.accountByEmail(a.email), undefined);
  assert.equal((await h.request("/state", { cookie: b.cookie })).status, 200);
});

test("SQLite reload preserves the account, revision, state and hashed session", async (t) => {
  const h = await harness(t),
    a = await h.register();
  const state = emptyState();
  state.meals = [meal()];
  assert.equal(
    (
      await h.request("/state", {
        method: "PUT",
        cookie: a.cookie,
        body: { state, revision: 0 },
      })
    ).status,
    200,
  );
  h.service.close();
  const recovered = createApp({ dataDir: h.dir, secureCookies: false, ai: {} });
  try {
    assert.deepEqual(recovered.store.snapshot(a.user.id), {
      state,
      revision: 1,
    });
    assert.equal(
      recovered.store.session(a.cookie.split("=")[1])?.id,
      a.user.id,
    );
    assert.equal(recovered.store.accountByEmail(a.email)?.id, a.user.id);
  } finally {
    recovered.close();
  }
});

test("PDF upload and attachment limit are enforced, and unreferenced files can be removed", async (t) => {
  const h = await harness(t),
    a = await h.register();
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n").toString(
    "base64",
  );
  const file = await h.request("/assets", {
    method: "POST",
    cookie: a.cookie,
    body: { name: "report.pdf", mime: "application/pdf", base64: pdf },
  });
  assert.equal(file.status, 201);
  const received = await h.request(`/assets/${file.data.id}`, {
    cookie: a.cookie,
  });
  assert.match(received.headers.get("content-disposition")!, /^attachment/);
  assert.equal(received.bytes.toString("base64"), pdf);
  const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
  const rejected = await h.request("/assets", {
    method: "POST",
    cookie: a.cookie,
    body: { name: "large.png", mime: "image/png", base64: tooBig },
  });
  assert.ok([400, 413].includes(rejected.status));
  assert.equal(
    (
      await h.request(`/assets/${file.data.id}`, {
        method: "DELETE",
        cookie: a.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.ok(!existsSync(join(h.dir, "uploads", a.user.id, file.data.id)));
});

test("auth requests are bounded by an address rate limit", async (t) => {
  const h = await harness(t);
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(
      (
        await h.request("/auth/login", {
          method: "POST",
          body: { email: "invalid", password: "short" },
        })
      ).status,
      400,
    );
  }
  const response = await h.request("/auth/login", {
    method: "POST",
    body: { email: "valid@example.com", password: PASSWORD },
  });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
});

test("CSRF origin and content type are enforced and disconnected capabilities remain false", async (t) => {
  const h = await harness(t);
  const capabilities = await h.request("/capabilities");
  assert.deepEqual(capabilities.data, {
    ai: false,
    apple: false,
    healthkit: false,
    mode: "local",
    foodPhoto: { available: false, provider: 'openai', reason: 'not_configured' },
  });
  const body = {
    email: "attack@example.com",
    password: PASSWORD,
    name: "User",
  };
  assert.equal(
    (
      await h.request("/auth/register", {
        method: "POST",
        body,
        origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await h.request("/auth/register", {
        method: "POST",
        body,
        contentType: "text/plain",
      })
    ).status,
    415,
  );
  assert.equal(
    (await h.request("/auth/register", { method: "POST", body, origin: "" }))
      .status,
    403,
  );
  assert.equal((await h.request("/state")).status, 401);
});
