/* Forma training workbench: runs before the app's first module (main.jsx imports it first and
 * loads the app only when it succeeded).
 *
 * The iframe isolates CSS and the hash router, not storage: this page shares localStorage,
 * sessionStorage, IndexedDB, the Cache API and BroadcastChannel with Forma itself, with any
 * other Forma account opened in this browser, and with a plain openGym that ever ran on this
 * origin (`gym_state_v1`). So every one of them is replaced, for this page only, by a view that
 * reads and writes under `forma-workbench:<account>:` and sees nothing else. The app's own code
 * keeps calling `localStorage.getItem('gym_state_v1')`; what it gets is this account's copy.
 * Forma's account deletion clears exactly that prefix (keys, databases and caches), so it must
 * not change.
 *
 * Fails closed: without a valid account, or when any one of the replacements does not take —
 * read back through the window and through globalThis — nothing of the app is loaded (main.jsx
 * shows why instead).
 */
import { ACCOUNT, LANG, PREFIX, fw, notifyAuthLost } from './context.js'

/* --------------------------------------------------------------- Web Storage -- */
function scopedStorage(real, prefix) {
  const own = () => {
    const keys = []
    for (let i = 0; i < real.length; i++) {
      const k = real.key(i)
      if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k.slice(prefix.length))
    }
    return keys
  }
  return Object.freeze({
    getItem: k => real.getItem(prefix + String(k)),
    setItem: (k, v) => real.setItem(prefix + String(k), String(v)),
    removeItem: k => real.removeItem(prefix + String(k)),
    // Only this account's keys: Forma's own and other accounts' stay where they are.
    clear: () => { for (const k of own()) real.removeItem(prefix + k) },
    key: i => own()[i] ?? null,
    get length() { return own().length },
  })
}

/* A `storage` event names the real key. Only this account's keys reach the app, with the prefix
   taken off and the scoped view as their storageArea; everything else (Forma's keys, another
   account's, a clear() somebody else ran) never does. */
function installStorageEvents(win, prefix, areas, controlStorage) {
  const mapEvent = e => {
    const area = areas.get(e.storageArea) || null
    if (!area || typeof e.key !== 'string' || !e.key.startsWith(prefix)) return null
    return {
      type: 'storage', key: e.key.slice(prefix.length), oldValue: e.oldValue, newValue: e.newValue,
      url: e.url, storageArea: area, isTrusted: e.isTrusted, timeStamp: e.timeStamp,
    }
  }
  const realAdd = win.addEventListener
  const realRemove = win.removeEventListener
  // Forma changes this control key on login, logout and account deletion. Keep a private native
  // listener before filtering the app's storage events, so already-open tabs also lock offline.
  realAdd.call(win, 'storage', e => {
    if (e.storageArea === controlStorage && e.key === 'forma-session-change') notifyAuthLost(403)
  })
  const wrapped = new WeakMap()
  const wrap = listener => {
    let w = wrapped.get(listener)
    if (!w) {
      w = e => {
        const m = mapEvent(e)
        if (!m) return
        if (typeof listener === 'function') listener.call(win, m)
        else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(m)
      }
      wrapped.set(listener, w)
    }
    return w
  }
  win.addEventListener = function (type, listener, opts) {
    if (type !== 'storage' || !listener) return realAdd.call(this, type, listener, opts)
    return realAdd.call(this, type, wrap(listener), opts)
  }
  win.removeEventListener = function (type, listener, opts) {
    if (type !== 'storage' || !listener) return realRemove.call(this, type, listener, opts)
    const w = wrapped.get(listener)
    return w ? realRemove.call(this, type, w, opts) : undefined
  }
  let handler = null
  Object.defineProperty(win, 'onstorage', {
    configurable: true, enumerable: true,
    get: () => handler,
    set: fn => {
      if (handler) win.removeEventListener('storage', handler)
      handler = typeof fn === 'function' ? fn : null
      if (handler) win.addEventListener('storage', handler)
    },
  })
}

/* --------------------------------------------------------------- IndexedDB -- */
function scopedIndexedDB(real, prefix) {
  const open = real.open.bind(real)
  const del = real.deleteDatabase.bind(real)
  const list = typeof real.databases === 'function' ? real.databases.bind(real) : null
  const scoped = {
    open: (name, version) => (version === undefined ? open(prefix + String(name)) : open(prefix + String(name), version)),
    deleteDatabase: name => del(prefix + String(name)),
    cmp: (a, b) => real.cmp(a, b),
  }
  if (list) {
    scoped.databases = async () => (await list())
      .filter(d => typeof d?.name === 'string' && d.name.startsWith(prefix))
      .map(d => ({ ...d, name: d.name.slice(prefix.length) }))
  }
  return Object.freeze(scoped)
}

/* ---------------------------------------------------------------- Cache API -- */
function scopedCaches(real, prefix) {
  const own = async () => (await real.keys()).filter(n => n.startsWith(prefix))
  return Object.freeze({
    open: name => real.open(prefix + String(name)),
    has: name => real.has(prefix + String(name)),
    delete: name => real.delete(prefix + String(name)),
    keys: async () => (await own()).map(n => n.slice(prefix.length)),
    // Never the global match: that would search Forma's and other accounts' caches too.
    match: async (request, opts) => {
      if (opts && typeof opts.cacheName === 'string') {
        const name = prefix + opts.cacheName
        if (!(await real.has(name))) return undefined
        return (await real.open(name)).match(request, opts)
      }
      for (const n of await own()) {
        const hit = await (await real.open(n)).match(request, opts)
        if (hit) return hit
      }
      return undefined
    },
  })
}

/* ----------------------------------------------------------- BroadcastChannel -- */
function scopedBroadcastChannel(Real, prefix) {
  return class extends Real { constructor(name) { super(prefix + String(name)) } }
}

/* --------------------------------------------------------------------- boot -- */
const failure = (code, message) => ({ ok: false, code, message })
const isolationFailed = () => failure('no-isolation', fw('无法为当前账户隔离本地存储，训练工作台未启动。', 'Local storage could not be isolated for this account, so the workbench did not start.'))

/**
 * Binds `win` to `account` and replaces every storage global it has. Exported for the tests; the
 * page itself runs it once, below, on the real window. `{ ok: true, replaced }` or `{ ok: false,
 * code, message }` — and on failure the caller loads nothing.
 */
export function installWorkbench(win = window, { account = ACCOUNT, prefix = PREFIX, lang = LANG, doc = win.document, global = globalThis } = {}) {
  if (!account || !prefix) {
    return failure('no-account', fw('请从 Forma 的训练页面打开训练工作台。', 'Open the training workbench from Forma’s Training page.'))
  }
  let realLocal, realSession
  try {
    realLocal = win.localStorage
    realSession = win.sessionStorage
    if (!realLocal || !realSession) throw new Error('no storage')
    const probe = prefix + '__probe'
    realLocal.setItem(probe, '1'); realLocal.removeItem(probe)
  } catch {
    return failure('no-storage', fw('此浏览器禁止了本地存储，训练工作台无法安全运行。', 'This browser blocks local storage, so the workbench cannot run safely.'))
  }

  // Every facade, by the global it replaces. Only what this browser has is replaced, and every
  // one of those has to be in place afterwards.
  const facades = new Map()
  facades.set('localStorage', scopedStorage(realLocal, prefix))
  facades.set('sessionStorage', scopedStorage(realSession, prefix))
  try {
    if (win.indexedDB) facades.set('indexedDB', scopedIndexedDB(win.indexedDB, prefix))
    if (win.caches) facades.set('caches', scopedCaches(win.caches, prefix))
    if (typeof win.BroadcastChannel === 'function') facades.set('BroadcastChannel', scopedBroadcastChannel(win.BroadcastChannel, prefix))
  } catch {
    return isolationFailed()
  }

  try {
    for (const [name, value] of facades) {
      Object.defineProperty(win, name, { configurable: true, enumerable: true, get: () => value, set: () => {} })
    }
    installStorageEvents(win, prefix, new Map([[realLocal, facades.get('localStorage')], [realSession, facades.get('sessionStorage')]]), realLocal)
  } catch {
    return isolationFailed()
  }

  // Read back, through the window and — when this is the page's own window — through globalThis,
  // which is what the app's bare `localStorage`, `indexedDB`… resolve to.
  const sameGlobal = win === global || win === global.window
  for (const [name, value] of facades) {
    let took = false
    try { took = win[name] === value && (!sameGlobal || global[name] === value) } catch { took = false }
    if (!took) return isolationFailed()
  }

  if (doc?.documentElement) {
    doc.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
    doc.documentElement.dir = 'ltr'
  }
  return { ok: true, replaced: [...facades.keys()] }
}

export const boot = (() => {
  try { return installWorkbench() } catch { return isolationFailed() }
})()
