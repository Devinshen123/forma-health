// Forma training workbench entry. The bootstrap binds this page to the Forma account it was opened
// for and scopes all browser storage to it before any app module is evaluated; only then is the
// app itself loaded. Without that, the page says why and loads nothing else.
import { boot } from './workbench/bootstrap.js'

if (boot.ok) {
  import('./app-main.jsx')
} else {
  const root = document.getElementById('root')
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.style.cssText = 'max-width:420px;margin:28vh auto 0;padding:24px;font:16px/1.5 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#171b20;text-align:center'
  const title = document.createElement('h1')
  title.style.cssText = 'font-size:20px;margin:0 0 8px'
  title.textContent = 'Forma'
  const text = document.createElement('p')
  text.style.cssText = 'margin:0;color:#4b5260'
  text.textContent = boot.message
  box.append(title, text)
  root.replaceChildren(box)
}
