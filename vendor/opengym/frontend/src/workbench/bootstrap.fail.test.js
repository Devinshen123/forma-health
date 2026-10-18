// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { installWorkbench } from './bootstrap.js'

const A = '11111111-2222-4333-8444-555555555555'
const P = `forma-workbench:${A}:`

const memory = () => {
  const m = new Map()
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)) },
    removeItem: k => { m.delete(String(k)) },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}
class FakeChannel { constructor(name) { this.name = name } }
const fakeIdb = () => ({ open: n => ({ opened: n }), deleteDatabase: n => ({ deleted: n }), cmp: () => 0, databases: async () => [{ name: P + 'media' }, { name: 'other' }] })
const fakeCaches = () => {
  const names = new Set([P + 'a', 'forma-shell'])
  return { open: async n => ({ name: n, match: async () => undefined }), has: async n => names.has(n), delete: async n => names.delete(n), keys: async () => [...names] }
}
// A window-like object with every storage global, each a plain configurable data property.
function fakeWindow(overrides = {}) {
  const win = {
    localStorage: memory(), sessionStorage: memory(), indexedDB: fakeIdb(), caches: fakeCaches(), BroadcastChannel: FakeChannel,
    addEventListener() {}, removeEventListener() {}, document: null,
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v && v.locked) Object.defineProperty(win, k, { configurable: false, enumerable: true, writable: false, value: v.value })
    else win[k] = v
  }
  return win
}
const opts = { account: A, prefix: P, lang: 'zh', global: {} }

describe('installWorkbench', () => {
  it('replaces every available storage global with a facade under the account prefix', async () => {
    const win = fakeWindow()
    const realIdb = win.indexedDB
    const r = installWorkbench(win, opts)
    expect(r.ok).toBe(true)
    expect(r.replaced.sort()).toEqual(['BroadcastChannel', 'caches', 'indexedDB', 'localStorage', 'sessionStorage'])
    expect(win.indexedDB).not.toBe(realIdb)
    expect(win.indexedDB.open('opengym-media').opened).toBe(P + 'opengym-media')
    expect(await win.indexedDB.databases()).toEqual([{ name: 'media' }])
    expect(await win.caches.keys()).toEqual(['a'])
    expect(new win.BroadcastChannel('sync').name).toBe(P + 'sync')
  })

  it('also requires the globalThis view to be replaced when it is the same global', () => {
    const win = fakeWindow()
    const global = { window: win }   // globalThis still serves the old objects
    Object.defineProperty(global, 'localStorage', { configurable: false, value: win.localStorage })
    const r = installWorkbench(win, { ...opts, global })
    expect(r).toMatchObject({ ok: false, code: 'no-isolation' })
  })

  for (const name of ['indexedDB', 'caches', 'BroadcastChannel', 'sessionStorage']) {
    it(`refuses to start when ${name} cannot be replaced`, () => {
      const win = fakeWindow({ [name]: { locked: true, value: fakeWindow()[name] } })
      const r = installWorkbench(win, opts)
      expect(r).toMatchObject({ ok: false, code: 'no-isolation' })
    })
  }

  it('refuses to start when a facade cannot be built from what the browser has', () => {
    const r = installWorkbench(fakeWindow({ indexedDB: { open: null } }), opts)
    expect(r).toMatchObject({ ok: false, code: 'no-isolation' })
  })

  it('only replaces what exists, and still succeeds then', () => {
    const win = fakeWindow({ caches: undefined, BroadcastChannel: undefined })
    const r = installWorkbench(win, opts)
    expect(r.ok).toBe(true)
    expect(r.replaced.sort()).toEqual(['indexedDB', 'localStorage', 'sessionStorage'])
  })

  it('refuses without an account and without storage', () => {
    expect(installWorkbench(fakeWindow(), { ...opts, account: null, prefix: null })).toMatchObject({ ok: false, code: 'no-account' })
    const blocked = fakeWindow({ localStorage: { setItem() { throw new Error('blocked') } } })
    expect(installWorkbench(blocked, opts)).toMatchObject({ ok: false, code: 'no-storage' })
  })
})

describe('main.jsx', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('./bootstrap.js'); vi.doUnmock('../app-main.jsx') })

  it('loads no app module and shows the reason when the bootstrap failed', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const appLoaded = vi.fn()
    vi.doMock('./bootstrap.js', () => ({ boot: { ok: false, code: 'no-isolation', message: 'isolation failed' } }))
    vi.doMock('../app-main.jsx', () => { appLoaded(); return {} })
    await import('../main.jsx')
    await new Promise(r => setTimeout(r, 0))
    expect(appLoaded).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]').textContent).toContain('isolation failed')
  })

  it('loads the app when the bootstrap succeeded', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const appLoaded = vi.fn()
    vi.doMock('./bootstrap.js', () => ({ boot: { ok: true } }))
    vi.doMock('../app-main.jsx', () => { appLoaded(); return {} })
    await import('../main.jsx')
    await vi.waitFor(() => expect(appLoaded).toHaveBeenCalled())
  })
})
