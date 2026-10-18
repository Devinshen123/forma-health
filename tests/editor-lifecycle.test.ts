import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { AttachmentLifecycle } from "../src/features/attachmentLifecycle";
import { analyzeFoodPhoto, ApiError, request, setAccountHint, uploadFile } from "../src/api";
import { createSleepDraft, sleepEntryFromDraft, sleepOverlaps, upsertSleep } from "../src/features/sleepEditor";

test("a new sleep retry after an accepted write and lost response updates the original identity", async () => {
  const draft = { ...createSleepDraft("Etc/UTC"), quality: "3", energy: "4" };
  const start = "2026-10-15T23:30:00.000Z", end = "2026-10-16T07:30:00.000Z";
  const first = sleepEntryFromDraft(draft, start, end);
  const other = sleepEntryFromDraft({ ...createSleepDraft("Etc/UTC"), quality: "4", energy: "4" },
    "2026-10-14T23:00:00.000Z", "2026-10-15T07:00:00.000Z");
  let accepted = [other];
  const saveWithLostResponse = async () => {
    accepted = upsertSleep(accepted, first);
    throw new TypeError("response lost after server accepted the sleep");
  };
  await assert.rejects(saveWithLostResponse(), /response lost/);

  // Sync can discover the accepted record while its original "new" editor stays
  // open. The retry must replace that record, and must not overlap with itself.
  assert.equal(draft.existing, false);
  const observed = structuredClone(accepted);
  const retry = sleepEntryFromDraft({ ...draft, quality: "5" }, start, end);
  assert.equal(sleepOverlaps(observed, draft.id, start, end), false);
  accepted = upsertSleep(observed, retry);
  accepted = upsertSleep(accepted, sleepEntryFromDraft({ ...draft, quality: "5" }, start, end));
  assert.equal(accepted.length, 2);
  assert.deepEqual(accepted[0], other, "retry preserves unrelated sleep records");
  assert.equal(accepted[1].id, first.id);
  assert.equal(accepted[1].createdAt, first.createdAt);
  assert.equal(accepted[1].quality, 5);
  assert.equal(accepted[1].date, "2026-10-16");
  assert.deepEqual(observed, [other, first], "retry construction must not mutate the last observed snapshot");
  const nextDraft = createSleepDraft("Etc/UTC");
  assert.notEqual(nextDraft.id, draft.id, "a separately opened draft must get its own identity");
});

test("sleep edit identity and overlap checks preserve self-retry, other records, and adjacent intervals", () => {
  const originalDraft = { ...createSleepDraft("Etc/UTC"), quality: "3", energy: "4" };
  const original = sleepEntryFromDraft(originalDraft, "2026-10-15T23:00:00.000Z", "2026-10-16T07:00:00.000Z");
  const editing = createSleepDraft("America/New_York", original);
  assert.equal(editing.existing, true);
  assert.equal(editing.id, original.id);
  assert.equal(editing.createdAt, original.createdAt);
  assert.equal(editing.timezone, "Etc/UTC");
  assert.equal(editing.originalStart, original.start);
  assert.equal(editing.originalEnd, original.end);
  assert.equal(sleepOverlaps([original], editing.id, original.start, original.end), false);
  assert.equal(sleepOverlaps([original], "another-synthetic-sleep", original.start, original.end), true);
  assert.equal(sleepOverlaps([original], "another-synthetic-sleep", original.end, "2026-10-16T08:00:00.000Z"), false);
  assert.equal(sleepOverlaps([original], "another-synthetic-sleep", "2026-10-15T22:00:00.000Z", original.start), false);
  const firstOccurrence = { ...original, timezone: "America/New_York", start: "2026-11-01T05:10:00.000Z", end: "2026-11-01T05:40:00.000Z" };
  assert.equal(sleepOverlaps([firstOccurrence], "synthetic-second-occurrence", "2026-11-01T06:10:00.000Z", "2026-11-01T06:40:00.000Z"), false,
    "the two fall-back 01:10–01:40 intervals have distinct instants and must not overlap");
});

const sleepTimeInZone = (timezone: string, expression: string) => {
  const moduleUrl = new URL("../src/features/sleepTime.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    `import {resolveSleepTime, toSleepTimeInput} from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(${expression}));`,
  ], { cwd: process.cwd(), env: { ...process.env, TZ: timezone }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test("editing only sleep quality preserves the second fall-back occurrence and hidden seconds", () => {
  const original = "2026-11-01T06:30:45.123Z";
  const result = sleepTimeInZone("America/New_York", `({
    input: toSleepTimeInput(${JSON.stringify(original)}),
    unchanged: resolveSleepTime("2026-11-01T01:30", ${JSON.stringify(original)}),
    changed: resolveSleepTime("2026-11-01T01:31", ${JSON.stringify(original)}),
    newEntry: resolveSleepTime("2026-11-01T01:30")
  })`);
  assert.equal(result.input, "2026-11-01T01:30");
  assert.deepEqual(result.unchanged, { status: "valid", instant: original });
  assert.deepEqual(result.changed, { status: "ambiguous" });
  assert.deepEqual(result.newEntry, { status: "ambiguous" });
  assert.equal(Date.parse(result.unchanged.instant), Date.parse(original));
});

test("sleep entries reject daylight-saving gaps and handle half-hour folds without guessing", () => {
  assert.deepEqual(sleepTimeInZone("America/New_York", `[
    resolveSleepTime("2026-03-08T02:30"),
    resolveSleepTime("2026-03-08T03:30"),
    resolveSleepTime("2026-11-01T02:30")
  ]`), [
    { status: "gap" },
    { status: "valid", instant: "2026-03-08T07:30:00.000Z" },
    { status: "valid", instant: "2026-11-01T07:30:00.000Z" },
  ]);
  assert.deepEqual(sleepTimeInZone("Australia/Lord_Howe", `[
    resolveSleepTime("2026-04-05T01:45"),
    resolveSleepTime("2026-04-05T01:45", "2026-04-04T15:15:17.050Z"),
    resolveSleepTime("2026-10-04T02:15")
  ]`), [
    { status: "ambiguous" },
    { status: "valid", instant: "2026-04-04T15:15:17.050Z" },
    { status: "gap" },
  ]);
});

test("ordinary sleep input retains precise instants and invalid dates never normalize silently", () => {
  assert.deepEqual(sleepTimeInZone("Etc/UTC", `[
    resolveSleepTime("2026-10-16T08:30"),
    resolveSleepTime("2026-10-16T08:30:12.4"),
    resolveSleepTime("2026-02-30T08:30"),
    resolveSleepTime("2026-10-16T24:00"),
    resolveSleepTime("")
  ]`), [
    { status: "valid", instant: "2026-10-16T08:30:00.000Z" },
    { status: "valid", instant: "2026-10-16T08:30:12.400Z" },
    { status: "invalid" }, { status: "invalid" }, { status: "invalid" },
  ]);
});

test("cancelling a never-submitted editor cleans only its own uploaded attachment", async () => {
  const removed: string[] = [];
  const editor = new AttachmentLifecycle(async id => { removed.push(id); });
  editor.stage("synthetic-unused-photo");
  await editor.discard();
  await editor.discard();
  assert.deepEqual(removed, ["synthetic-unused-photo"]);
  assert.equal(editor.id, null);
});

test("uncertain save followed by cancellation preserves attachments referenced by a queue or accepted write", async t => {
  for (const outcome of ["queued-offline", "accepted-response-lost"]) {
    await t.test(outcome, async () => {
      const removed: string[] = [], references: string[] = [];
      const editor = new AttachmentLifecycle(async id => { removed.push(id); });
      editor.stage("synthetic-submitted-photo");
      editor.retainForSave(editor.id!);
      await assert.rejects(async () => {
        references.push(editor.id!);
        throw new TypeError(outcome);
      });
      // Both modal cancellation and unmount may attempt cleanup after the error.
      await editor.discard();
      await editor.discard();
      assert.deepEqual(references, ["synthetic-submitted-photo"]);
      assert.deepEqual(removed, [], "a server reference check cannot see the client's queued reference");
      assert.equal(editor.id, null);
    });
  }
});

test("a submitted attachment stays reusable for retry; replacing it cleans the new unused file only", async () => {
  const removed: string[] = [];
  const editor = new AttachmentLifecycle(async id => { removed.push(id); });
  editor.stage("synthetic-queued-report");
  editor.retainForSave(editor.id!);
  assert.equal(editor.id, "synthetic-queued-report", "retention must not remove the retry's attachment identity");
  editor.retainForSave(editor.id!);
  await editor.discard();
  editor.stage("synthetic-unused-replacement");
  await editor.discard();
  assert.deepEqual(removed, ["synthetic-unused-replacement"]);
});

test("cleanup failures remain retryable and a delayed cleanup cannot clear a newer upload", async () => {
  let finish!: () => void;
  const removed: string[] = [];
  const editor = new AttachmentLifecycle(async id => {
    removed.push(id);
    await new Promise<void>(resolve => { finish = resolve; });
  });
  editor.stage("synthetic-old-unused");
  const cleanup = editor.discard();
  editor.stage("synthetic-new-unused");
  finish();
  await cleanup;
  assert.equal(editor.id, "synthetic-new-unused");
  assert.deepEqual(removed, ["synthetic-old-unused"]);

  let attempts = 0;
  const retryable = new AttachmentLifecycle(async () => { if (++attempts === 1) throw new TypeError("offline"); });
  retryable.stage("synthetic-retry-cleanup");
  await assert.rejects(retryable.discard(), /offline/);
  assert.equal(retryable.id, "synthetic-retry-cleanup");
  await retryable.discard();
  assert.equal(attempts, 2);
  assert.equal(retryable.id, null);
});

test("an old editor keeps its explicit account for upload, analysis, cleanup and settings requests", async t => {
  const originalFetch = globalThis.fetch;
  const readerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "FileReader");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const calls: { path: string; owner: string | null }[] = [];
  class SyntheticReader {
    result = "data:image/png;base64,c3ludGhldGlj";
    onload: (() => void) | null = null;
    readAsDataURL() { queueMicrotask(() => this.onload?.()); }
  }
  globalThis.FileReader = SyntheticReader as unknown as typeof FileReader;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "en" } });
  globalThis.fetch = async (input, options) => {
    const owner = new Headers(options?.headers).get("X-Forma-Account");
    calls.push({ path: String(input), owner });
    // The current cookie is account B. Stale A requests must be rejected, never
    // silently sent with B's mutable account hint.
    assert.equal(owner, "synthetic-account-A");
    return new Response(JSON.stringify({ error: "Account changed" }), { status: 409 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (readerDescriptor) Object.defineProperty(globalThis, "FileReader", readerDescriptor);
    else Reflect.deleteProperty(globalThis, "FileReader");
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
    setAccountHint(null);
  });
  const editorOwner = "synthetic-account-A";
  setAccountHint("synthetic-account-B");
  const stale = (operation: Promise<unknown>) => assert.rejects(operation, (error: unknown) => error instanceof ApiError && error.status === 409);
  await stale(uploadFile(new File(["synthetic"], "fixture.png", { type: "image/png" }), undefined, editorOwner));
  await stale(analyzeFoodPhoto("synthetic-asset", "en", undefined, editorOwner));
  for (const [path, method] of [["/assets/synthetic-asset", "DELETE"], ["/export", "GET"], ["/account", "DELETE"]]) {
    await stale(request(path, { method, headers: { "X-Forma-Account": editorOwner } }));
  }
  assert.equal(calls.length, 5);
});
