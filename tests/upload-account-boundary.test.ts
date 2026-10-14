import { test } from "node:test";
import assert from "node:assert/strict";
import { setAccountHint, uploadFile } from "../src/api";

// Disposable browser-boundary fixtures. These tests do not upload a real file or use a live account.
class ControlledFileReader {
  static instances: ControlledFileReader[] = [];
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  aborted = false;
  constructor() { ControlledFileReader.instances.push(this); }
  readAsDataURL(_file: Blob) { /* The test explicitly completes the asynchronous read. */ }
  finish() { this.result = "data:image/png;base64,cWEtdGVzdC1maXh0dXJl"; this.onload?.(); }
  abort() { this.aborted = true; this.onabort?.(); }
}

test("AI-04: FileReader account switch and cancellation cannot silently upload as another account", async t => {
  const savedFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "FileReader");
  globalThis.FileReader = ControlledFileReader as unknown as typeof FileReader;
  const calls: { input: string; options?: RequestInit }[] = [];
  globalThis.fetch = async (input, options) => {
    calls.push({ input: String(input), options });
    return new Response(JSON.stringify({ id: "qa-fixture-asset", name: "fixture.png", mime: "image/png" }), { status: 201, headers: { "content-type": "application/json" } });
  };
  t.after(() => {
    globalThis.fetch = savedFetch;
    if (descriptor) Object.defineProperty(globalThis, "FileReader", descriptor);
    else Reflect.deleteProperty(globalThis, "FileReader");
    setAccountHint(null);
  });
  const file = new File(["QA fixture only"], "fixture.png", { type: "image/png" });

  await t.test("a delayed read preserves the initiating account even after the page changes accounts", async () => {
    ControlledFileReader.instances = []; calls.length = 0;
    setAccountHint("qa-account-A");
    const operation = uploadFile(file);
    assert.equal(ControlledFileReader.instances.length, 1);
    setAccountHint("qa-account-B");
    ControlledFileReader.instances[0].finish();
    await operation;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "/api/assets");
    assert.equal(new Headers(calls[0].options?.headers).get("X-Forma-Account"), "qa-account-A", "the server must reject an A request if the browser's current cookie belongs to B, rather than saving the image into B");
  });

  await t.test("an already cancelled operation does not even start a read or POST", async () => {
    ControlledFileReader.instances = []; calls.length = 0;
    const controller = new AbortController(); controller.abort();
    await assert.rejects(uploadFile(file, controller.signal), { name: "AbortError" });
    assert.equal(ControlledFileReader.instances.length, 0);
    assert.equal(calls.length, 0);
  });

  await t.test("cancelling an in-progress read aborts FileReader and prevents POST", async () => {
    ControlledFileReader.instances = []; calls.length = 0;
    const controller = new AbortController();
    const operation = uploadFile(file, controller.signal);
    const rejection = assert.rejects(operation, { name: "AbortError" });
    assert.equal(ControlledFileReader.instances.length, 1);
    controller.abort();
    await rejection;
    assert.equal(ControlledFileReader.instances[0].aborted, true);
    assert.equal(calls.length, 0);
  });
});
