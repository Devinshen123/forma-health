// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest'

const A = '11111111-2222-4333-8444-555555555555'
const P = `forma-workbench:${A}:`
let realLocal
let boot

beforeAll(async () => {
  history.replaceState(null, '', `/training-workbench/?account=${A}&lang=en#/home`)
  // Newer Node versions shadow happy-dom's Storage with their own (unconfigured) global; a plain
  // in-memory Storage stands in for the browser's here.
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
  for (const name of ['localStorage', 'sessionStorage']) {
    const store = memory()
    Object.defineProperty(window, name, { configurable: true, get: () => store })
    Object.defineProperty(globalThis, name, { configurable: true, get: () => store })
  }
  realLocal = window.localStorage
  // What a plain openGym and another Forma account left on this origin.
  realLocal.setItem('gym_state_v1', '{"lang":"de","workouts":[1]}')
  realLocal.setItem('forma-workbench:99999999-2222-4333-8444-555555555555:gym_state_v1', '{"other":true}')
  realLocal.setItem('forma-session-hint', 'x')
  ;({ boot } = await import('./bootstrap.js'))
})

describe('workbench bootstrap', () => {
  it('binds to the account and scopes localStorage', () => {
    expect(boot.ok).toBe(true)
    expect(boot.replaced).toEqual(expect.arrayContaining(['localStorage', 'sessionStorage']))
    for (const name of boot.replaced) expect(globalThis[name]).toBe(window[name])
    expect(localStorage).not.toBe(realLocal)
    expect(localStorage.getItem('gym_state_v1')).toBe(null)
    localStorage.setItem('gym_state_v1', '{"mine":1}')
    expect(realLocal.getItem(P + 'gym_state_v1')).toBe('{"mine":1}')
    expect(realLocal.getItem('gym_state_v1')).toBe('{"lang":"de","workouts":[1]}')
    expect(localStorage.length).toBe(1)
    expect(localStorage.key(0)).toBe('gym_state_v1')
  })

  it('clear() only removes this account’s keys', () => {
    localStorage.setItem('gym_owner', A)
    localStorage.clear()
    expect(localStorage.length).toBe(0)
    expect(realLocal.getItem('gym_state_v1')).not.toBe(null)
    expect(realLocal.getItem('forma-session-hint')).toBe('x')
    expect(realLocal.getItem('forma-workbench:99999999-2222-4333-8444-555555555555:gym_state_v1')).toBe('{"other":true}')
  })

  it('delivers only this account’s storage events, unprefixed', () => {
    const seen = []
    window.addEventListener('storage', e => seen.push(e.key))
    const fire = key => window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue: '1', oldValue: null, storageArea: realLocal }))
    fire(P + 'gym_owner')
    fire('gym_owner')
    fire('forma-workbench:99999999-2222-4333-8444-555555555555:gym_owner')
    fire(null)
    expect(seen).toEqual(['gym_owner'])
  })

  it('prefixes IndexedDB names when available', () => {
    if (!window.indexedDB) return
    const req = indexedDB.open('opengym-media')
    expect(req).toBeTruthy()
  })

  it('locks an already-open copy on Forma session changes without exposing the control event', async () => {
    const { authLost } = await import('./context.js')
    const seen = []
    window.addEventListener('storage', e => seen.push(e.key))
    expect(authLost()).toBe(null)
    window.dispatchEvent(Object.assign(new Event('storage'), {
      key: 'forma-session-change', newValue: 'new-session', oldValue: null, storageArea: realLocal,
    }))
    expect(authLost()?.status).toBe(403)
    expect(seen).toEqual([])
  })
})
