// Forma training workbench: Web Push is not part of this site. openGym's push needed its own
// service worker and push server; Forma has neither for training, so every entry point says
// "unsupported" and nothing is ever subscribed or sent. The exports keep their shape so the
// screens that ask simply hide the push rows. In-page rest sounds, vibration and the screen
// flash are unaffected (lib/sound.js, components/TimerFlash.jsx).
const unsupported = () => Promise.reject(Object.assign(new Error('Push notifications are not available here.'), { code: 'push-unavailable' }))

export const pushSupported = () => false
export const pushPermission = () => 'unsupported'
export const deviceId = () => undefined
export const enablePush = unsupported
export const disablePush = async () => {}
export const syncPushSubscription = async () => {}
export const sendTestPush = unsupported
