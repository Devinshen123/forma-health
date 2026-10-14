import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import sharp from "sharp";
import { createApp, type AppOptions } from "../server/app";
import { emptyState, type AppState, type FoodPhotoDraft, type Meal } from "../src/types";

// Fixtures only: these values are deliberately fake and are never sent to a real provider.
// Every configured test injects raw HTTP responses. No test reads OPENAI_API_KEY.
const TEST_API_KEY = "qa-fixture-only-not-a-live-key";
const TEST_PASSWORD = "QA disposable local fixture password 2026";
const ORIGIN = "http://127.0.0.1:5173";
const MODEL = "gpt-5.4-mini-2026-03-17";
const TEST_NOW = Date.parse("2026-10-14T18:00:00.000Z");
const PROVIDER_SENTINEL = "QA_PRIVATE_PROVIDER_ERROR_DO_NOT_RETURN";
const META_SENTINEL = "QA_PRIVATE_EXIF_DO_NOT_SEND";

const estimate = () => ({
  isFood: true,
  items: [{ name: "Fixture rice", grams: 150, per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }],
  warnings: ["Fixture estimate. Portion needs review."],
});
function envelope(value: unknown = estimate()) {
  return {
    id: "resp_qa_fixture", object: "response", status: "completed", model: MODEL,
    output: [{ id: "msg_qa_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }],
    usage: { input_tokens: 50, output_tokens: 80, total_tokens: 130 },
  };
}
const rawResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
type Captured = { url: string; headers: Headers; body: Record<string, any> };
function provider(responses: Array<() => Response | Promise<Response>> = [() => rawResponse(envelope())]) {
  const calls: Captured[] = [];
  const transport: typeof fetch = async (input, init) => {
    assert.equal(typeof init?.body, "string", "production adapter must send its real serialized body to the injected transport");
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const response = responses[Math.min(calls.length - 1, responses.length - 1)];
    return await response();
  };
  return { calls, transport };
}
interface Session { cookie: string; id: string }
interface HttpResult { status: number; body: any; response: Response }
interface ClientOptions { session?: Session; headers?: Record<string, string>; signal?: AbortSignal }
type AiOptions = NonNullable<AppOptions["ai"]>;

async function harness(t: TestContext, options: { ai?: AiOptions; fetch?: typeof fetch; now?: () => number } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "forma-independent-photo-qa-"));
  const ai = options.ai ?? { apiKey: TEST_API_KEY, timeoutMs: 1000, retryDelayMs: 0 };
  const fallback = provider();
  const transport = options.fetch ?? fallback.transport;
  let service: ReturnType<typeof createApp>;
  let server: Server;
  let base = "";
  let active = false;
  const start = async () => {
    service = createApp({ dataDir: directory, secureCookies: false, ai, aiFetch: transport, aiNow: options.now ?? (() => TEST_NOW) });
    server = service.app.listen(0, "127.0.0.1");
    await new Promise<void>(done => server.once("listening", done));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
    active = true;
  };
  const stop = async () => {
    if (!active) return;
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    service.close();
    active = false;
  };
  await start();
  t.after(async () => {
    await stop();
    const target = resolve(directory), parent = resolve(tmpdir());
    assert.ok(target.startsWith(parent + sep) && target.includes("forma-independent-photo-qa-"), "recursive cleanup must stay inside this test's verified temporary directory");
    rmSync(target, { recursive: true, force: true });
  });
  const request = async (method: string, path: string, body?: unknown, client: ClientOptions = {}): Promise<HttpResult> => {
    const headers: Record<string, string> = { Origin: ORIGIN, "Content-Type": "application/json" };
    if (client.session) { headers.Cookie = client.session.cookie; headers["X-Forma-Account"] = client.session.id; }
    Object.assign(headers, client.headers);
    const response = await fetch(`${base}/api${path}`, { method, headers, signal: client.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const json = await response.json();
    return { status: response.status, body: json, response };
  };
  const register = async (label = "owner"): Promise<Session> => {
    const result = await request("POST", "/auth/register", { email: `qa-${label}-${randomUUID()}@example.test`, password: TEST_PASSWORD, name: `QA ${label} fixture` });
    assert.equal(result.status, 201);
    const cookie = result.response.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(cookie);
    return { cookie, id: result.body.user.id };
  };
  const upload = async (session: Session, bytes?: Buffer, mime = "image/png") => {
    const image = bytes ?? await sharp({ create: { width: 24, height: 16, channels: 3, background: "#758d68" } }).png().toBuffer();
    const result = await request("POST", "/assets", { name: "synthetic-qa-fixture", mime, base64: image.toString("base64") }, { session });
    assert.equal(result.status, 201);
    return result.body.id as string;
  };
  const analyze = (session: Session, assetId: string, extra: Record<string, unknown> = {}) => request("POST", "/food-photo-drafts", { assetId, consent: true, language: "en", ...extra }, { session });
  const exportFor = (session: Session) => request("GET", "/export", undefined, { session });
  const snapshotFor = (session: Session) => request("GET", "/state", undefined, { session });
  return { request, register, upload, analyze, exportFor, snapshotFor, restart: async () => { await stop(); await start(); }, get service() { return service; } };
}
function reviewedMeal(draft: FoodPhotoDraft, overrides: Partial<Meal> = {}): Meal {
  return {
    id: randomUUID(), date: "2026-10-14", name: "Corrected fixture food", type: "lunch", grams: 210,
    referenceGrams: 100, kcal: 155, protein: 4, carbs: 29, fat: 2,
    source: "ai_estimate", aiDraftId: draft.id, aiItemIndex: 0, assetId: draft.assetId,
    createdAt: "2026-10-14T18:00:00.000Z", ...overrides,
  };
}
async function saveMeal(h: Awaited<ReturnType<typeof harness>>, session: Session, meal: Meal) {
  const snapshot = await h.snapshotFor(session);
  assert.equal(snapshot.status, 200);
  const state: AppState = { ...snapshot.body.state, meals: [...snapshot.body.state.meals, meal] };
  return h.request("PUT", "/state", { state, revision: snapshot.body.revision }, { session });
}
function assertSafeError(result: HttpResult, status: number, code: string) {
  assert.equal(result.status, status);
  assert.equal(result.body.code, code);
  assert.equal(typeof result.body.error, "string");
  const serialized = JSON.stringify(result.body);
  assert.ok(!serialized.includes(PROVIDER_SENTINEL));
  assert.ok(!serialized.includes(TEST_API_KEY));
  assert.ok(!serialized.includes("stack"));
}

test("AI-04: real adapter request shape, metadata stripping and separate immutable draft", async t => {
  const stub = provider();
  const h = await harness(t, { fetch: stub.transport });
  const owner = await h.register("private-owner");
  const profile = { name: "QA_USER_NAME_NOT_FOR_PROVIDER", goal: "performance", experience: "new", trainingDays: 3, timeMinutes: 45, equipment: "gym", allergies: "QA_HEALTH_NOTE_NOT_FOR_PROVIDER", restrictions: "", language: "en", units: "metric", timezone: "UTC", sleepGoal: 8, cloudConsent: false, aiConsent: false };
  assert.equal((await h.request("PUT", "/state", { state: { ...emptyState(), profile }, revision: 0 }, { session: owner })).status, 200);
  const image = await sharp({ create: { width: 1800, height: 600, channels: 3, background: "#758d68" } }).withExif({ IFD0: { Artist: META_SENTINEL, ImageDescription: META_SENTINEL } }).jpeg().toBuffer();
  assert.ok((await sharp(image).metadata()).exif, "fixture itself must contain metadata to test removal");
  const assetId = await h.upload(owner, image, "image/jpeg");
  const result = await h.analyze(owner, assetId);
  assert.equal(result.status, 201);
  const draft = result.body as FoodPhotoDraft;
  assert.equal(draft.assetId, assetId);
  assert.equal(draft.provider, "openai");
  assert.equal(draft.model, MODEL);
  assert.deepEqual(draft.consent, { acceptedAt: new Date(TEST_NOW).toISOString(), version: "food-photo-v1", language: "en" }, "consent proof must come from the server, not the provider or client");
  assert.deepEqual(draft.items, estimate().items);
  assert.equal(stub.calls.length, 1);
  const call = stub.calls[0];
  assert.equal(call.url, "https://api.openai.com/v1/responses");
  assert.equal(call.headers.get("authorization"), `Bearer ${TEST_API_KEY}`);
  assert.equal(call.body.model, MODEL);
  assert.equal(call.body.store, false);
  assert.equal(call.body.max_output_tokens, 2000);
  assert.equal(call.body.reasoning?.effort, "none");
  assert.equal(call.body.text?.format?.type, "json_schema");
  assert.equal(call.body.text?.format?.strict, true);
  const content = call.body.input.flatMap((message: any) => message.content ?? []);
  const images = content.filter((part: any) => part.type === "input_image");
  assert.equal(images.length, 1);
  assert.equal(images[0].detail, "high");
  assert.match(images[0].image_url, /^data:image\/jpeg;base64,/);
  const processed = Buffer.from(images[0].image_url.split(",")[1], "base64");
  const metadata = await sharp(processed).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok(metadata.width! <= 1024 && metadata.height! <= 1024);
  assert.equal(metadata.exif, undefined);
  assert.ok(!processed.includes(Buffer.from(META_SENTINEL)));
  assert.ok(!JSON.stringify(call.body).includes("QA_USER_NAME_NOT_FOR_PROVIDER"));
  assert.ok(!JSON.stringify(call.body).includes("QA_HEALTH_NOTE_NOT_FOR_PROVIDER"));
  assert.ok(!JSON.stringify(call.body).includes(owner.id));
  const snapshot = await h.snapshotFor(owner);
  assert.deepEqual(snapshot.body.state.meals, []);
  assert.equal(snapshot.body.state.profile.aiConsent, false, "per-photo consent must not silently enable ongoing profile consent");
  const exported = await h.exportFor(owner);
  assert.equal(exported.body.aiDrafts.length, 1);
  assert.deepEqual(exported.body.aiDrafts[0].items, estimate().items);
  const meal = reviewedMeal(draft);
  assert.equal((await saveMeal(h, owner, meal)).status, 200, "user corrections to every food field must be permitted after review");
  const after = await h.exportFor(owner);
  assert.deepEqual(after.body.state.meals[0], meal);
  assert.deepEqual(after.body.aiDrafts[0].items, estimate().items, "editing the saved meal must not rewrite the original AI draft");
});

test("AI-04: uncertain and non-food outputs preserve nulls and never auto-save meals", async t => {
  const uncertain = { isFood: true, items: [{ name: "Uncertain fixture food", grams: null, per100g: { kcal: null, protein: 0, carbs: null, fat: null } }], warnings: ["Portion and nutrition are uncertain."] };
  const stub = provider([() => rawResponse(envelope(uncertain)), () => rawResponse(envelope({ isFood: false, items: [], warnings: ["No food identified."] }))]);
  const h = await harness(t, { fetch: stub.transport });
  const owner = await h.register();
  const asset = await h.upload(owner);
  const first = await h.analyze(owner, asset);
  assert.equal(first.status, 201);
  assert.equal(first.body.items[0].grams, null);
  assert.equal(first.body.items[0].per100g.kcal, null);
  assert.equal(first.body.items[0].per100g.protein, 0, "a genuinely returned zero must remain distinguishable from unknown");
  const cannotSaveNull = reviewedMeal(first.body, { kcal: null as unknown as number });
  assert.equal((await saveMeal(h, owner, cannotSaveNull)).status, 400);
  const second = await h.analyze(owner, asset);
  assert.equal(second.status, 201);
  assert.equal(second.body.isFood, false);
  assert.deepEqual(second.body.items, []);
  assert.deepEqual((await h.snapshotFor(owner)).body.state.meals, []);
  assert.equal(stub.calls.length, 2);
});

test("AI-04: private asset ownership, account binding, consent and strict input precede provider calls", async t => {
  const stub = provider();
  const h = await harness(t, { fetch: stub.transport });
  const a = await h.register("a"), b = await h.register("b");
  const asset = await h.upload(a);
  assert.equal((await h.request("POST", "/food-photo-drafts", { assetId: asset, consent: true, language: "en" })).status, 401);
  assert.equal((await h.analyze(b, asset)).status, 404);
  assert.equal((await h.analyze(b, randomUUID())).status, 404);
  const staleAccount = await h.request("POST", "/food-photo-drafts", { assetId: asset, consent: true, language: "en" }, { session: a, headers: { "X-Forma-Account": b.id } });
  assert.equal(staleAccount.status, 401);
  assert.equal(staleAccount.body.code, "ACCOUNT_CHANGED");
  assertSafeError(await h.analyze(a, asset, { consent: false }), 400, "AI_CONSENT_REQUIRED");
  const missingConsent = await h.request("POST", "/food-photo-drafts", { assetId: asset, language: "en" }, { session: a });
  assertSafeError(missingConsent, 400, "AI_CONSENT_REQUIRED");
  for (const extra of [{ user_id: b.id }, { imageUrl: "https://qa.invalid/not-fetched.png" }, { model: "untrusted-client-model" }, { language: "xx" }, { acceptedAt: "2020-01-01T00:00:00Z" }]) {
    assert.equal((await h.analyze(a, asset, extra)).status, 400);
  }
  assert.equal((await h.request("POST", "/food-photo-drafts", { assetId: asset, consent: true, language: "en" }, { session: a, headers: { Origin: "https://qa-untrusted.invalid" } })).status, 403);
  assert.equal(stub.calls.length, 0);
  assert.deepEqual((await h.exportFor(a)).body.aiDrafts, []);
});

test("AI-04: provenance is server-owned, while user-reviewed names, portions and nutrition remain editable", async t => {
  const h = await harness(t);
  const a = await h.register("a"), b = await h.register("b");
  const asset = await h.upload(a), anotherAsset = await h.upload(a), bAsset = await h.upload(b);
  const result = await h.analyze(a, asset);
  assert.equal(result.status, 201);
  const draft = result.body as FoodPhotoDraft;
  const valid = reviewedMeal(draft);
  for (const invalid of [
    { ...valid, aiDraftId: randomUUID() },
    { ...valid, aiItemIndex: 8 },
    { ...valid, referenceGrams: 150 },
    { ...valid, assetId: anotherAsset },
    { ...valid, aiDraftId: undefined },
    { ...valid, source: "manual" as const },
    { ...valid, source: "label" as const },
  ]) assert.equal((await saveMeal(h, a, invalid)).status, 400);
  assert.equal((await saveMeal(h, b, { ...valid, assetId: bAsset })).status, 400, "another account cannot claim a draft even if it supplies its own attachment");
  assert.equal((await saveMeal(h, a, valid)).status, 200);
  assert.equal((await h.request("DELETE", `/assets/${asset}`, {}, { session: a })).status, 409, "a reviewed record retains its private attachment");
  const snapshot = await h.snapshotFor(a);
  assert.equal(snapshot.body.state.meals[0].source, "ai_estimate");
  assert.equal(snapshot.body.state.meals[0].aiDraftId, draft.id);
  assert.deepEqual((await h.snapshotFor(b)).body.state.meals, []);
});

test("AI-04: no key and invalid configuration fail safely without a transport call", async t => {
  for (const [name, ai, code, reason] of [
    ["not configured", {}, "AI_NOT_CONFIGURED", "not_configured"],
    ["invalid", { apiKey: TEST_API_KEY, timeoutMs: -1 }, "AI_CONFIG_INVALID", "invalid_config"],
  ] as const) await t.test(name, async child => {
    const stub = provider();
    const h = await harness(child, { ai, fetch: stub.transport });
    const owner = await h.register(), asset = await h.upload(owner);
    const caps = await h.request("GET", "/capabilities");
    assert.equal(caps.body.foodPhoto.available, false);
    assert.equal(caps.body.foodPhoto.reason, reason);
    assertSafeError(await h.analyze(owner, asset), 503, code);
    assert.equal(stub.calls.length, 0);
    assert.deepEqual((await h.exportFor(owner)).body.aiDrafts, []);
  });
});

test("AI-04: injected raw transport cannot bypass production output validation", async t => {
  const invalidOutputs: [string, unknown][] = [
    ["wrong primitive", { ...estimate(), isFood: "true" }],
    ["too many candidates", { ...estimate(), items: Array.from({ length: 9 }, () => estimate().items[0]) }],
    ["missing nullable field", { isFood: true, items: [{ name: "Fixture", grams: 100, per100g: { kcal: 130, protein: 2, carbs: 28 } }], warnings: [] }],
    ["negative nutrient", { ...estimate(), items: [{ ...estimate().items[0], per100g: { ...estimate().items[0].per100g, fat: -1 } }] }],
    ["impossible macros", { ...estimate(), items: [{ ...estimate().items[0], per100g: { kcal: 130, protein: 70, carbs: 70, fat: 70 } }] }],
    ["untrusted extra field", { ...estimate(), diagnosis: PROVIDER_SENTINEL }],
    ["extra item field", { ...estimate(), items: [{ ...estimate().items[0], provider: PROVIDER_SENTINEL }] }],
    ["extra nutrition field", { ...estimate(), items: [{ ...estimate().items[0], per100g: { ...estimate().items[0].per100g, healthScore: 90 } }] }],
    ["non-food with candidates", { ...estimate(), isFood: false }],
    ["control character in name", { ...estimate(), items: [{ ...estimate().items[0], name: "Fixture\u0000label" }] }],
    ["control character in warning", { ...estimate(), warnings: ["Fixture\u0000warning"] }],
  ];
  for (const [name, output] of invalidOutputs) await t.test(name, async child => {
    const stub = provider([() => rawResponse(envelope(output))]);
    const h = await harness(child, { fetch: stub.transport });
    const owner = await h.register(), asset = await h.upload(owner);
    assertSafeError(await h.analyze(owner, asset), 502, "AI_INVALID_OUTPUT");
    assert.equal(stub.calls.length, 1, "validation failures must not be retried or turned into fabricated results");
    assert.deepEqual((await h.exportFor(owner)).body.aiDrafts, []);
    assert.deepEqual((await h.snapshotFor(owner)).body.state.meals, []);
  });
});

test("AI-04: malformed envelope, invalid JSON, incomplete response and refusal degrade safely", async t => {
  const cases: [string, () => Response, number, string][] = [
    ["malformed envelope", () => rawResponse({ items: estimate().items }), 502, "AI_INVALID_OUTPUT"],
    ["bad output JSON", () => rawResponse({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: `{${PROVIDER_SENTINEL}` }] }] }), 502, "AI_INVALID_OUTPUT"],
    ["incomplete response", () => rawResponse({ ...envelope(), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), 502, "AI_INVALID_OUTPUT"],
    ["refusal", () => rawResponse({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: PROVIDER_SENTINEL }] }] }), 422, "AI_REFUSED"],
  ];
  for (const [name, response, status, code] of cases) await t.test(name, async child => {
    const stub = provider([response]);
    const h = await harness(child, { fetch: stub.transport });
    const owner = await h.register(), asset = await h.upload(owner);
    assertSafeError(await h.analyze(owner, asset), status, code);
    assert.equal(stub.calls.length, 1);
    assert.deepEqual((await h.exportFor(owner)).body.aiDrafts, []);
  });
});

test("AI-04: retryable failures reserve each attempt; retries do not count as an extra user request", async t => {
  const stub = provider([() => rawResponse({ error: { message: PROVIDER_SENTINEL } }, 503), () => rawResponse(envelope())]);
  const h = await harness(t, { fetch: stub.transport });
  const owner = await h.register(), asset = await h.upload(owner);
  assert.equal((await h.analyze(owner, asset)).status, 201);
  assert.equal(stub.calls.length, 2);
  const exported = await h.exportFor(owner);
  assert.equal(exported.body.aiUsage[0].requests, 1);
  assert.equal(exported.body.aiUsage[0].attempts, 2);
  assert.equal(exported.body.aiUsage[0].reservedUsd, 0.04);
  assert.equal(exported.body.aiReservations.length, 2);
  assert.ok(exported.body.aiReservations.every((record: any) => record.reservedUsd === 0.02 && record.model === MODEL));
  assert.equal(exported.body.aiDrafts.length, 1);
});

test("AI-04: terminal HTTP error is sanitized and not retried; repeated transient errors stop after two attempts", async t => {
  for (const [name, httpStatus, expectedCalls] of [["authentication", 401, 1], ["transient", 500, 2], ["rate limited provider", 429, 2]] as const) await t.test(name, async child => {
    const stub = provider([() => rawResponse({ error: { message: PROVIDER_SENTINEL, key: TEST_API_KEY } }, httpStatus)]);
    const h = await harness(child, { fetch: stub.transport });
    const owner = await h.register(), asset = await h.upload(owner);
    assertSafeError(await h.analyze(owner, asset), 502, "AI_UNAVAILABLE");
    assert.equal(stub.calls.length, expectedCalls);
    const exported = await h.exportFor(owner);
    assert.equal(exported.body.aiUsage[0].attempts, expectedCalls);
    assert.equal(exported.body.aiUsage[0].reservedUsd, 0.02 * expectedCalls);
    assert.deepEqual(exported.body.aiDrafts, []);
  });
});

test("AI-04: real abort-aware timeout is bounded, retried once and never refunded", async t => {
  let calls = 0;
  const transport: typeof fetch = async (_input, init) => {
    calls++;
    return await new Promise<Response>((_resolve, reject) => {
      const abort = () => reject(new DOMException("QA fixture transport aborted", "AbortError"));
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener("abort", abort, { once: true });
    });
  };
  const h = await harness(t, { ai: { apiKey: TEST_API_KEY, timeoutMs: 30, retryDelayMs: 0 }, fetch: transport });
  const owner = await h.register(), asset = await h.upload(owner);
  const started = Date.now();
  assertSafeError(await h.analyze(owner, asset), 504, "AI_TIMEOUT");
  assert.ok(Date.now() - started < 2000);
  assert.equal(calls, 2);
  const exported = await h.exportFor(owner);
  assert.equal(exported.body.aiUsage[0].reservedUsd, 0.04);
  assert.deepEqual(exported.body.aiDrafts, []);
});

test("AI-04: daily request cap survives restart and a new UTC day resets only its own bucket", async t => {
  let now = TEST_NOW;
  const stub = provider();
  const h = await harness(t, { ai: { apiKey: TEST_API_KEY, dailyRequestLimit: 1, timeoutMs: 1000, retryDelayMs: 0 }, fetch: stub.transport, now: () => now });
  const owner = await h.register(), asset = await h.upload(owner);
  assert.equal((await h.analyze(owner, asset)).status, 201);
  await h.restart();
  assertSafeError(await h.analyze(owner, asset), 429, "AI_BUDGET_LIMIT");
  assert.equal(stub.calls.length, 1);
  now += 24 * 60 * 60 * 1000;
  assert.equal((await h.analyze(owner, asset)).status, 201);
  const exported = await h.exportFor(owner);
  assert.equal(exported.body.aiUsage.length, 2);
  assert.ok(exported.body.aiUsage.every((usage: any) => usage.requests === 1 && usage.attempts === 1));
});

test("AI-04: attempt budget prevents an unaffordable retry and survives process restart", async t => {
  const stub = provider([() => rawResponse({ error: { message: PROVIDER_SENTINEL } }, 503)]);
  const h = await harness(t, { ai: { apiKey: TEST_API_KEY, reservedUsdPerAttempt: 0.02, dailyReservedUsdLimit: 0.02, timeoutMs: 1000, retryDelayMs: 0 }, fetch: stub.transport });
  const owner = await h.register(), asset = await h.upload(owner);
  assertSafeError(await h.analyze(owner, asset), 429, "AI_BUDGET_LIMIT");
  assert.equal(stub.calls.length, 1, "the second provider attempt must never start once reservation reaches the cap");
  await h.restart();
  assertSafeError(await h.analyze(owner, asset), 429, "AI_BUDGET_LIMIT");
  assert.equal(stub.calls.length, 1);
  const exported = await h.exportFor(owner);
  assert.equal(exported.body.aiUsage[0].attempts, 1);
  assert.equal(exported.body.aiUsage[0].reservedUsd, 0.02);
  assert.equal(exported.body.aiReservations.length, 1);
});

test("AI-04: five-per-minute rate limit is durable and does not block another account", async t => {
  let now = TEST_NOW;
  const stub = provider();
  const h = await harness(t, { fetch: stub.transport, now: () => now });
  const owner = await h.register(), asset = await h.upload(owner);
  for (let i = 0; i < 5; i++) assert.equal((await h.analyze(owner, asset)).status, 201);
  await h.restart();
  assertSafeError(await h.analyze(owner, asset), 429, "AI_RATE_LIMIT");
  assert.equal(stub.calls.length, 5);
  const another = await h.register("another"), anotherAsset = await h.upload(another);
  assert.equal((await h.analyze(another, anotherAsset)).status, 201);
  now += 61_000;
  assert.equal((await h.analyze(owner, asset)).status, 201);
});

test("AI-04: project-wide reservations survive account deletion, recreation and restart", async t => {
  let now = TEST_NOW;
  const stub = provider();
  const h = await harness(t, { ai: { apiKey: TEST_API_KEY, globalDailyReservedUsdLimit: 0.04, timeoutMs: 1000, retryDelayMs: 0 }, fetch: stub.transport, now: () => now });
  const a = await h.register("global-a"), b = await h.register("global-b");
  assert.equal((await h.analyze(a, await h.upload(a))).status, 201);
  assert.equal((await h.analyze(b, await h.upload(b))).status, 201);
  assert.equal(stub.calls.length, 2);
  assert.equal((await h.request("DELETE", "/account", { password: TEST_PASSWORD }, { session: a })).status, 200);
  await h.restart();
  const c = await h.register("global-c"), asset = await h.upload(c);
  assertSafeError(await h.analyze(c, asset), 429, "AI_BUDGET_LIMIT");
  assert.equal(stub.calls.length, 2, "deleting and replacing an account must not refund the global attempt budget");
  const exported = await h.exportFor(b);
  assert.equal(exported.body.aiUsage[0].reservedUsd, 0.02);
  assert.equal(exported.body.aiReservations.length, 1, "owner exports must not reveal another account's reservations");
  assert.ok(!JSON.stringify(exported.body).includes("globalDailyUsage"));
  now += 24 * 60 * 60 * 1000;
  assert.equal((await h.analyze(c, asset)).status, 201);
  assert.equal(stub.calls.length, 3);
});

test("AI-04: consent timestamp is captured before provider work and follows the requested language", async t => {
  let now = TEST_NOW;
  const stub = provider([() => { now += 60_000; return rawResponse(envelope()); }]);
  const h = await harness(t, { fetch: stub.transport, now: () => now });
  const owner = await h.register(), asset = await h.upload(owner);
  const result = await h.analyze(owner, asset, { language: "zh" });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body.consent, { acceptedAt: new Date(TEST_NOW).toISOString(), version: "food-photo-v1", language: "zh" });
  assert.ok(Date.parse(result.body.createdAt) > Date.parse(result.body.consent.acceptedAt));
  const exported = await h.exportFor(owner);
  assert.deepEqual(exported.body.aiDrafts[0].consent, result.body.consent);
});

test("AI-04: per-account in-flight lock rejects duplicate expensive work", async t => {
  let release!: (value: Response) => void;
  let announce!: () => void;
  const started = new Promise<void>(done => { announce = done; });
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; announce(); return await new Promise<Response>(done => { release = done; }); };
  const h = await harness(t, { fetch: transport, ai: { apiKey: TEST_API_KEY, timeoutMs: 3000, retryDelayMs: 0 } });
  const owner = await h.register(), asset = await h.upload(owner);
  const first = h.analyze(owner, asset);
  await Promise.race([started, first.then(result => { throw new Error(`Provider was not reached: ${result.status}`); })]);
  assertSafeError(await h.analyze(owner, asset), 429, "AI_RATE_LIMIT");
  assert.equal(calls, 1);
  release(rawResponse(envelope()));
  assert.equal((await first).status, 201);
});

test("AI-04: unsupported, corrupt, oversized and pixel-limit images never reach the provider", async t => {
  const stub = provider();
  const h = await harness(t, { fetch: stub.transport });
  const owner = await h.register();
  const gif = Buffer.from("GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000", "binary");
  const gifAsset = await h.upload(owner, gif, "image/gif");
  assertSafeError(await h.analyze(owner, gifAsset), 400, "AI_IMAGE_INVALID");
  const corruptPng = Buffer.alloc(32); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(corruptPng); corruptPng.write("IHDR", 12, "ascii");
  const corrupt = await h.upload(owner, corruptPng);
  assertSafeError(await h.analyze(owner, corrupt), 400, "AI_IMAGE_INVALID");
  const small = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#758d68" } }).png().toBuffer();
  const large = await h.upload(owner, Buffer.concat([small, Buffer.alloc(5 * 1024 * 1024)]));
  assertSafeError(await h.analyze(owner, large), 400, "AI_IMAGE_INVALID");
  const overPixels = await sharp({ create: { width: 5000, height: 4001, channels: 3, background: "#758d68" } }).png().toBuffer();
  const pixelAsset = await h.upload(owner, overPixels);
  assertSafeError(await h.analyze(owner, pixelAsset), 400, "AI_IMAGE_INVALID");
  assert.equal(stub.calls.length, 0);
});

test("AI-04: cancelling an unreferenced private asset removes its drafts; referenced assets stay protected", async t => {
  const h = await harness(t);
  const owner = await h.register(), asset = await h.upload(owner);
  assert.equal((await h.analyze(owner, asset)).status, 201);
  assert.equal((await h.exportFor(owner)).body.aiDrafts.length, 1);
  assert.equal((await h.request("DELETE", `/assets/${asset}`, {}, { session: owner })).status, 200);
  assert.deepEqual((await h.exportFor(owner)).body.aiDrafts, []);
  assert.equal((await h.analyze(owner, asset)).status, 404);
});

test("AI-04: deleting the attachment while inference is in flight cannot resurrect a draft", async t => {
  let release!: (value: Response) => void;
  let announce!: () => void;
  const started = new Promise<void>(done => { announce = done; });
  const transport: typeof fetch = async () => { announce(); return await new Promise<Response>(done => { release = done; }); };
  const h = await harness(t, { fetch: transport, ai: { apiKey: TEST_API_KEY, timeoutMs: 3000, retryDelayMs: 0 } });
  const owner = await h.register(), asset = await h.upload(owner);
  const inFlight = h.analyze(owner, asset);
  await Promise.race([started, inFlight.then(result => { throw new Error(`Provider was not reached: ${result.status}`); })]);
  assert.equal((await h.request("DELETE", `/assets/${asset}`, {}, { session: owner })).status, 200);
  release(rawResponse(envelope()));
  assert.ok((await inFlight).status >= 400, "a removed attachment cannot produce a usable success response");
  const exported = await h.exportFor(owner);
  assert.deepEqual(exported.body.aiDrafts, []);
  assert.deepEqual(exported.body.assets, []);
  assert.equal(exported.body.aiUsage[0].reservedUsd, 0.02, "actual provider attempts remain charged to the application's reservation ledger after cancellation");
  assert.deepEqual(h.service.store.db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("AI-04: deleting an account during inference cannot recreate private rows or usable output", async t => {
  let release!: (value: Response) => void;
  let announce!: () => void;
  const started = new Promise<void>(done => { announce = done; });
  const transport: typeof fetch = async () => { announce(); return await new Promise<Response>(done => { release = done; }); };
  const h = await harness(t, { fetch: transport, ai: { apiKey: TEST_API_KEY, timeoutMs: 3000, retryDelayMs: 0 } });
  const owner = await h.register(), asset = await h.upload(owner);
  const inFlight = h.analyze(owner, asset);
  await Promise.race([started, inFlight.then(result => { throw new Error(`Provider was not reached: ${result.status}`); })]);
  assert.equal((await h.request("DELETE", "/account", { password: TEST_PASSWORD }, { session: owner })).status, 200);
  release(rawResponse(envelope()));
  assert.ok((await inFlight).status >= 400);
  assert.equal((await h.exportFor(owner)).status, 401);
  assert.equal(h.service.store.db.prepare("SELECT count(*) AS n FROM accounts WHERE id=?").get(owner.id)?.n, 0);
  assert.equal(h.service.store.db.prepare("SELECT count(*) AS n FROM assets WHERE owner_id=?").get(owner.id)?.n, 0);
  assert.deepEqual(h.service.store.db.prepare("PRAGMA foreign_key_check").all(), []);
});
