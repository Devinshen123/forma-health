import { useEffect, useState } from 'react'

/* Forma workbench: the system's "reduce motion" preference. openGym's global CSS only stops CSS
   animations; the exercise clips are <video> loops and kept autoplaying. With the preference on,
   media open on the still frame and play only when the person asks (components/Media.jsx,
   components/CustomMedia.jsx). */
const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(win = globalThis) {
  try { return !!win.matchMedia?.(QUERY).matches } catch { return false }
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => prefersReducedMotion())
  useEffect(() => {
    let mql = null
    try { mql = globalThis.matchMedia?.(QUERY) || null } catch { mql = null }
    if (!mql) return
    const onChange = () => setReduced(!!mql.matches)
    onChange()
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange)
    else if (typeof mql.addListener === 'function') mql.addListener(onChange)
    return () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange)
      else if (typeof mql.removeListener === 'function') mql.removeListener(onChange)
    }
  }, [])
  return reduced
}
