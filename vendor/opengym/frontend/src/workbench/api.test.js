// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

const A = '11111111-2222-4333-8444-555555555555'
let api, apiBlob, apiUpload, announceSaved, authLost

beforeAll(async () => {
  history.replaceState(null, '', `/training-workbench/?account=${A}&lang=zh#/home`)
  ;({ api, apiBlob, apiUpload, announceSaved } = await import('../lib/api.js'))
  ;({ authLost } = await import('./context.js'))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('workbench api adapter', () => {
  it('sends me/config/data under /training-workbench/api with the account header and same-origin cookies', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { calls.push({ url, init }); return json({ ok: true }) }))
    await api('/api/me'); await api('/api/config'); await api('/api/data'); await api('/api/data/rev')
    expect(calls.map(c => c.url)).toEqual(['/training-workbench/api/me', '/training-workbench/api/config', '/training-workbench/api/data', '/training-workbench/api/data/rev'])
    for (const c of calls) {
      expect(c.init.headers['X-Forma-Account']).toBe(A)
      expect(c.init.credentials).toBe('same-origin')
    }
  })

  it('refuses openGym-only routes without a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const p of ['/api/logout', '/api/login/options', '/api/pair/create', '/api/admin/users', '/api/coach/status', '/api/push/test', '/api/activity']) {
      await expect(api(p, { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'workbench-unavailable' })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('tells the parent only {type, account} at this origin after a saved PUT /api/data', async () => {
    const post = vi.spyOn(window.parent, 'postMessage')
    // In this test window.parent is window itself; a framed page has a different parent.
    const parent = { postMessage: vi.fn() }
    const win = { parent, location: { origin: 'http://127.0.0.1:3001' } }
    expect(announceSaved(win)).toBe(true)
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'forma-workbench-saved', account: A }, 'http://127.0.0.1:3001')
    expect(announceSaved({ parent: null, location: win.location })).toBe(false)
    const self = { location: win.location }; self.parent = self
    expect(announceSaved(self)).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })

  it('announces after a successful PUT /api/data and never with state in the message', async () => {
    const fetch = vi.fn(async () => json({ rev: 2, wid: 'w' }))
    vi.stubGlobal('fetch', fetch)
    const sent = []
    const parent = { postMessage: (m, o) => sent.push([m, o]) }
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent)
    await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: { workouts: [{ id: 'x' }] }, stamped: true, baseRev: 1, baseWid: 'w' }) })
    expect(sent).toEqual([[{ type: 'forma-workbench-saved', account: A }, location.origin]])
    // A refused save (409) announces nothing.
    fetch.mockImplementation(async () => json({ error: 'conflict', state: {} }, 409))
    await expect(api('/api/data', { method: 'PUT', body: '{}' })).rejects.toMatchObject({ status: 409 })
    expect(sent).toHaveLength(1)
  })

  it('apiBlob and apiUpload carry the account header too', async () => {
    const seen = []
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { seen.push({ url, init }); return new Response(new Blob(['abc'])) }))
    const h = 'a'.repeat(64)
    await apiBlob('/api/media/' + h)
    expect(seen[0].url).toBe('/training-workbench/api/media/' + h)
    expect(seen[0].init.headers['X-Forma-Account']).toBe(A)
    expect(seen[0].init.credentials).toBe('same-origin')

    const headers = {}
    class XHR {
      open(method, url) { this.method = method; this.url = url }
      setRequestHeader(k, v) { headers[k] = v }
      getResponseHeader() { return null }
      send() { this.status = 201; this.responseText = '{"hash":"' + h + '"}'; this.onload() }
      abort() {}
    }
    await apiUpload('/api/media/' + h, new Blob(['x']), 'image/png', { XHR })
    expect(headers['X-Forma-Account']).toBe(A)
    expect(headers['Content-Type']).toBe('image/png')
  })

  it('a 401 ends the session for this page (the Forma notice), it never signs in anyone else', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'no session' }, 401)))
    await expect(api('/api/me')).rejects.toMatchObject({ status: 401 })
    expect(authLost()).toMatchObject({ status: 401 })
  })
})
