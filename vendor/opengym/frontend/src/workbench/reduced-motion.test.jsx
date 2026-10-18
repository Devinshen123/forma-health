// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: { gifSize: 'full' } }))
vi.mock('../store/useStore.js', () => {
  const snapshot = () => ({ S: mocks.S, update: mut => { const n = structuredClone(mocks.S); mut(n); mocks.S = n } })
  const useStore = selector => selector(snapshot())
  useStore.getState = snapshot
  return { useStore }
})

const { default: Media } = await import('../components/Media.jsx')

const EX = { id: '0001', n: 'bench press', gif: '0001.mp4', img: '0001.webp' }
let host, root, reduce
const setReduced = on => {
  reduce = on
  window.matchMedia = q => ({ matches: q.includes('reduce') && reduce, media: q, addEventListener() {}, removeEventListener() {} })
}
// happy-dom has no media playback: play() resolves and nothing more.
HTMLMediaElement.prototype.play = function () { return Promise.resolve() }
HTMLMediaElement.prototype.pause = function () {}

beforeEach(() => {
  mocks.S = { gifSize: 'full' }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Media ex={EX} />))
const control = () => host.querySelector('[data-media-control]')
const click = el => act(() => { el.click() })

describe('catalogue media and prefers-reduced-motion', () => {
  it('autoplays the clip without the preference (unchanged behaviour)', () => {
    setReduced(false)
    mount()
    expect(host.querySelector('video.catvid')).toBeTruthy()
    expect(control().dataset.mediaControl).toBe('pause')
  })

  it('opens on the still with reduced motion, and plays only on an explicit request', () => {
    setReduced(true)
    mount()
    expect(host.querySelector('video')).toBeFalsy()
    expect(host.querySelector('.exmedia img').getAttribute('src')).toBe('/exercise-media/opengym/still/0001.webp')
    expect(control().tagName).toBe('BUTTON')
    expect(control().dataset.mediaControl).toBe('play')
    click(control())
    expect(host.querySelector('video.catvid').getAttribute('src')).toBe('/exercise-media/opengym/clip/0001.mp4')
    // …and can be paused again by hand.
    click(control())
    expect(host.querySelector('video')).toBeFalsy()
    expect(control().dataset.mediaControl).toBe('play')
  })

  it('keeps a retry after a failed still, and the retry does not start the clip by itself', () => {
    setReduced(true)
    mount()
    act(() => { host.querySelector('.exmedia img').dispatchEvent(new Event('error')) })
    expect(control().dataset.mediaControl).toBe('retry')
    click(control())
    expect(host.querySelector('video')).toBeFalsy()
    expect(host.querySelector('.exmedia img')).toBeTruthy()
    expect(control().dataset.mediaControl).toBe('play')
  })
})
