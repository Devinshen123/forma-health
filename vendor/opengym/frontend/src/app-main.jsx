import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { useStore } from './store/useStore.js'
import { startMediaSync } from './lib/media-sync.js'
import './index.css'
import './workbench/workbench.css'

// Loaded by main.jsx only after workbench/bootstrap.js bound this page to one Forma account and
// scoped its storage. App.jsx restores per-route scroll itself; the browser's own attempt races it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// The photos and videos of custom exercises and workouts: uploads of what the server lacks
// (only to this site's /training-workbench/api/media), and the local clean-up.
startMediaSync(useStore)

// Forma workbench: no service worker of its own and no media prefetch. openGym's worker claimed
// the whole origin and its activate step deleted every same-origin cache, Forma's included; Forma's
// own offline shell is the only worker on this site.
