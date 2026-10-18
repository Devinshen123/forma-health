# WB-01 状态：openGym 训练工作台前端集成（真实 Claude Code）

- 执行者：本机 Claude Code CLI 会话（Opus 5.5），2026-10-18。
- 范围：只写了 `vendor/opengym/`、`scripts/build-training-workbench.mjs` 和本文件。没有改根配置、主 `src/`、`server/`、依赖或 package 版本；没有 git add/commit/push，没有启动服务、浏览器或安装依赖。
- 先读：本区 `AGENTS.md`、`docs/collaboration/TASKS.md` 顶部（WB-01..04）、`C:/Users/devin/.claude/skills/security-review/SKILL.md`（文件存在，已读，按其中的密钥、输入、认证、敏感数据几节检查）。只读了 `server/training-workbench.ts` 用来对照接口契约，没有修改。

## 结果

`node scripts/build-training-workbench.mjs`：**成功**（vite 8.1.5，273 个模块，在 `dist/training-workbench/` 生成 84 个文件，包括 index.html、assets、LICENSE、NOTICE.md）。只清空并写入 `dist/training-workbench/`，`dist/` 下其他文件没动。
`vendor/opengym/frontend` 里 vitest 跑新增的 `src/workbench/bootstrap.test.js`（happy-dom）：**4/4 通过**。上游原有的 vitest 套件没有跑；其中 Settings、登录、Coach、push 相关的用例本来就预期旧行为，预计会失败。

对产物做的静态检查：
- 动作媒体基址已经内联为 `/exercise-media/opengym/still/` 和 `/exercise-media/opengym/clip/`。5632 个 EXDB 条目的 `img`/`gif` 对照 `public/exercise-media/opengym/` 逐个核对，缺失 0 个。
- 产物中找不到 `serviceWorker.register`、`api/coach`、`register/options`（passkey）、`api.hevyapp.com`；也没有 sw.js 或 manifest.json（构建脚本会对 sw.js、manifest、.env、db、test、fixture 文件直接报错）。
- `X-Forma-Account` 已在入口 chunk 中。

## 实现要点

- **入口与绑定**：`src/main.jsx` 先执行 `workbench/bootstrap.js`。只有 account 是合法 UUID、存储隔离也确实生效时，才动态加载 `app-main.jsx`（App 本体）；否则只用纯 DOM 显示“请从 Forma 的训练页面打开”，不加载任何 App 模块，也不读缓存。account 和 lang 在模块加载时读取一次，之后固定（`workbench/context.js`）。
- **存储隔离**：把 window 上的 `localStorage`、`sessionStorage`、`indexedDB`、`caches`、`BroadcastChannel` 换成带 `forma-workbench:<account>:` 前缀的视图。`clear()` 和 `key()` 只涉及本账户的键。`storage` 事件（addEventListener 和 onstorage）只转发本前缀的事件，并去掉前缀；其他账户、Forma 自己的键和 key=null 的事件都丢弃。如果替换没生效，就不启动（fail-closed）。原 index.html 里读 `gym_state_v1` 的内联脚本已删除。lang 只取 URL 中的 zh/en，`default-lang.effectiveLang` 固定返回它，Settings 的语言一行改为只读“跟随 Forma”。
- **请求**：`lib/api.js` 的 `api`、`apiBlob`、`apiUpload` 只放行 me、config、data、data/rev、media/missing、media/sweep、media/<64位hex>；其他路径（logout、passkey、pair、admin、push、coach、activity）直接在本地拒绝，不发请求。每个请求都带 `X-Forma-Account`、`credentials: same-origin`。路径经 `appBase()` 变成 `/training-workbench/api/...`。远端 base、Bearer、CF Access 头都不再使用。`beacon()` 固定返回 false。`pairRedeem` 直接拒绝。Hevy API 请求在 `hevyGet` 入口就被阻断，Settings 里对应的一行也删了，CSV 导入保留。
- **会话**：boot 拿到 `/me` 后，如果 `user.id` 和绑定的 account 不一致，按 403 处理。遇到 401/403（包括同步途中）会触发 `notifyAuthLost`，App 只显示 `FormaGate`（“回到 Forma 重新登录”），不切换到 guest，也不接受新 cookie 对应的用户。本账户还没同步的副本留在它自己的命名空间里。`isGuest()` 恒为 false。Login、MobileOnboarding、device-link、push 订阅都已移出 App；SyncBanner 的“登录”改为回到 Forma。
- **隐藏的入口**：Coach、Admin 路由和 import 已删除（`coach-local` 不再被引用，所以不需要 `../api/coach/core`）；Plan 的 Coach 按钮已关闭；Settings 隐藏了 reminders/push、Coach、passkey、密码、配对、设备码、退出登录、管理员、Hevy、安卓/更新、安装提示、健身房签到、女性替代画法；账户页只剩“由 Forma 登录”和“立即同步”。重置时不再调用 coach forget。push.js 改为“不支持”的桩，useUI 不再预约服务器 push。健身房签到（二维码/条码）的路由、首页卡片和设置行都已移除。
- **SW**：不再注册 SW，也不启动 media-prefetch；`publicDir: false`，所以 public/sw.js 和 manifest 不会进入产物。
- **事实规则**：Stats 去掉了 Fatigue 和 Strength（保留力量）两种视图，只保留按实际记录组数统计的肌群分布。Structural balance 改成“模型参考”的说明，只显示“记录 / 参考表”的数值，不再给出 balanced/weak 判定和颜色；没有数据时显示“—”。
- **媒体**：`drawing()` 恒为 null，所以只用主动画和海报；人体图的男/女两种几何仍然保留。自定义动作和训练照片/视频照旧经 IDB 和 `apiBlob` 生成 object URL 显示；img/video 标签不直接请求私有 URL。
- **品牌**：新增 `forma` 强调色 #c5f467（浅色主题下文字用深橄榄色），设为默认，新副本默认浅色主题；标题为“Forma 训练工作台”，favicon 用 `/favicon.svg`。关于页保留 openGym（AGPL v3，© Duarte Santos）、MuscleMap（MIT）和 Gym visual 的署名，并说明这是修改版、源码随 Forma 提供。分享卡片、计划打印、FIT 文件中的产品名改为 Forma。构建脚本会把 LICENSE 和 NOTICE.md 复制进产物。
- **构建**：`vendor/opengym/frontend/vite.config.js`：base './'，outDir 为根 `dist/training-workbench`，emptyOutDir 为 false（由脚本只清理该子目录），`__APP_VERSION__` 取 vendor 的 package.json（1.4.1），VITE_* 全部写死在 config 里（`envPrefix` 设成不会匹配的前缀，脚本也会剥掉 shell 里的 VITE_*）。没有 Umami、mobile flavour 和 dev 代理。

## 第二轮（root 跟进 1–10）

1. **全部全局都要验证**：`bootstrap.js` 改为导出 `installWorkbench(win, opts)`。浏览器里实际存在的 localStorage、sessionStorage、indexedDB、caches、BroadcastChannel 都会生成 facade 并替换。替换后通过 `win[name]` 和 `globalThis[name]` 逐个读回比对。任何一个没有替换成功（或 facade 构建失败），都返回 `no-isolation`，`main.jsx` 不会加载 App。失败路径已有测试：上述每个全局被锁定时、globalThis 仍指向旧对象时、facade 构建失败时、缺少 account 或存储被禁用时；另外测了 main.jsx 在失败时不加载 app-main，成功时才加载。前缀仍是 `forma-workbench:<account>:`，没有改。
2. **保存后通知外层**：`PUT /api/data` 成功后，向 `window.parent.postMessage({type:'forma-workbench-saved',account}, location.origin)` 发消息。消息里只有这两个字段，不含任何 state；409 或失败时不发；没有父窗口或父窗口就是自己时也不发。
3. **接口契约**：me、config、data 以及 apiBlob、XHR 上传都带 `X-Forma-Account`（已测）。CAS 请求体沿用 source 原有的 `{state,stamped,baseRev,baseWid}`，没有改；响应里的 `warnings` 交给 root 读取。
4. 和 7. **iframe 与语言**：去掉 sandbox 后，“回到 Forma”会走 `window.top.location`。语言一直跟随父页面传入的 zh/en；Settings 的语言一行仍是只读的“跟随 Forma”。新副本的 `S.lang` 也改用 Forma 的语言，不再取浏览器语言。source 自己的 SW 仍然禁用。
6. **减少动态**：新增 `workbench/reduced-motion.js`。开启减少动态时，`Media.jsx` 先显示静帧，提示变成真正的按钮（`data-media-control`，可以播放、暂停、重试）；只有用户点击后才播放。重试不会自动开始播放。`CustomMedia.jsx` 里的短循环片段在这种模式下也不会自动播放。没有开启时，行为和原来一样。
8. **重置文案**：改为“清空当前训练记录……已保存的计划版本历史会保留，直到删除 Forma 账户”。
9. **About 页**：加了“下载源码 / Download source”（`./source.zip`，带 download 属性），以及 `./LICENSE`、`./NOTICE.md` 两个链接（构建脚本会把这两个文件复制进产物）。`source.zip` 由 root 的 `build-training-source.mjs` 生成，我没有生成。
10. root 已经跑过的 8 个纯逻辑套件我没有重复跑。

**本轮验证**：`src/workbench/` 下 4 个文件共 24/24 通过（bootstrap、bootstrap.fail、api、reduced-motion）。因为改了 Media 和 CustomMedia 的播放逻辑，又跑了上游相关的 6 个媒体组件测试文件：Media、Media.autoplay、Media.clip-memory、Media.thumb、CustomMedia*、CustomMediaField.offline，共 32/32 通过。构建成功，84 个文件；产物中能找到 `forma-workbench-saved`、`./source.zip` 和 reduced-motion 查询，找不到 `serviceWorker.register`。本轮仍然没有做浏览器验证，也没有删除任何普通训练功能。

本轮新增或修改的文件：`src/workbench/{bootstrap.js,reduced-motion.js,workbench.css,bootstrap.test.js,bootstrap.fail.test.js,api.test.js,reduced-motion.test.jsx}`，`src/lib/api.js`，`src/components/{Media.jsx,CustomMedia.jsx}`，`src/store/useStore.js`，`src/views/Settings.jsx`。

## 修改的文件

新增：`scripts/build-training-workbench.mjs`，`vendor/opengym/frontend/vite.config.js`，`src/app-main.jsx`，`src/workbench/{context.js,bootstrap.js,bootstrap.test.js,FormaGate.jsx,useAuthLost.js,workbench.css}`。
修改（均在 `vendor/opengym/frontend/` 下）：`index.html`，`src/main.jsx`，`src/App.jsx`，`src/lib/{api.js,push.js,default-lang.js,exercises.js,accent.js,format.js,import-hevy.js,fit-export.js,plan-share.js,workout-card.js}`，`src/store/{useStore.js,useUI.js}`，`src/views/{Settings.jsx,settings-pages.js,Home.jsx,Plan.jsx,Stats.jsx,StructuralBalance.jsx}`，`src/components/ServerSync.jsx`，`src/sheets.jsx`。来源目录 `reference-sources/openGym` 只读，没有修改。

## 未验证 / 风险 / 留给 root 或 backend 的事

1. **没有做任何浏览器验证。** iframe 实际运行、真实 Chrome/Edge/Safari 中 `localStorage` 能否覆盖（bootstrap 有 fail-closed 兜底）、CAS 409 合并、媒体上传/下载、计时、FIT/打印，都要等 root 的端到端测试。
2. **Forma 根 SW 的作用域**：Forma 自己的 SW 作用域是 `/`，会控制 `/training-workbench/` 页面及其 `/training-workbench/api/*` 请求。root 需要确认它不缓存 workbench 的 API 和私有媒体响应。workbench 的本地休息通知会复用这个注册（`getRegistration().showNotification`），前提是用户之前已经授予通知权限。
3. **服务端**：express 静态服务需要把 `/training-workbench/` 指向 `dist/training-workbench/index.html`，路径用 `./assets`，不需要 SPA 回退（路由在 hash 里）。backend 对非安全方法要求带 Origin；浏览器同源的 PUT/POST（fetch 和 XHR）会带上。
4. **语言**：现在完全跟随 Forma 的 zh/en，用户以前在 openGym 里选过的语言不再生效。zh 使用上游 `locales/zh.js`；workbench 新增的文案用 `fw()` 写成中英双语。部分上游原文中仍出现 “openGym” 字样（例如 iPhone 震动的说明）。
5. **AGPL §13**：修改版通过网络提供给用户，需要向用户提供对应的修改后源码。关于页已有说明，但实际的源码提供渠道（`vendor/opengym/` 的分发方式）要由 lead 决定。
6. 不可达代码（passkey、密码、配对、Admin、MobileOnboarding、更新检查）的源码还在 vendor 里，入口都已切断，其中一部分已被 tree-shake。上游 vitest 套件没有随这些改动更新。
7. `vendor/opengym/frontend/node_modules` 由 root 安装，`.gitignore` 是否覆盖它由 root 确认。
