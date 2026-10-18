# WB-01：真实 Claude Code 前端集成

用户最新指令：已得到 openGym 所有授权；将其所有功能放入 Forma 训练系统，并明确允许 Claude Code 一起合作。本轮由真实本机 Claude CLI 实施此独占任务，其余功能由 Codex 协调者/后端代理负责。AGENTS/TASKS 顶部的新任务优先于 CLAUDE 中上一轮历史限制。不得把自己称为已完成未运行的验证。

## 独占写入

只能写 `vendor/opengym/`、`scripts/build-training-workbench.mjs`、`docs/collaboration/status/claude-workbench.md`。root已复制授权 frontend/src/public/index.html/package*.json 和 LICENSE/NOTICE 到 vendor，并负责 npm ci。依赖/根配置/主src/server由root或其他agent负责，不得改。不得 git add/commit/push，不得改原始来源目录、真实data/.env或其他工作区。不读本机任何凭据，不改变Claude认证或模型，不安装依赖，不启动常驻服务，不结束任何进程。不创建其他任务/代理。

先读本区AGENTS、TASKS顶部，安全技能 `C:/Users/devin/.claude/skills/security-review/SKILL.md`；若文件不存在记录并用现有方式完成范围内任务。无需浏览器（测试由root串行执行），不把媒体输入AI，不读媒体原始字节作模型上下文。

## 目标

把已复制的完整 React 训练应用构建为同源子应用 `/training-workbench/`，在 Forma 的训练页通过iframe显示。不是反代8080，不能依赖来源node_modules绝对路径。保留完整计划、完成驱动轮转、库与人体、收藏/自定义动作/媒体、器械配置、训练组/计时/进阶、历史/统计、体重围度、进步照比较、训练附件、备份/打印/FIT等Web训练功能；主色/标题使用Forma，保留来源许可证归属。

## 会话和协议

外层iframe URL ` /training-workbench/?account=<Forma UUID>&lang=zh|en#/home`。account只作为当前iframe固定的stale-account绑定，非身份凭据；服务器仅信任HttpOnly cookie。没有account时停在清晰的“从Forma训练页打开”错误，不能静默进入guest或读任何共享缓存。

所有此子应用私有请求走 `/training-workbench/api/...`，每次JSON请求、apiBlob、apiUpload及其他私有fetch加 `X-Forma-Account: <初始account>`，cookie same-origin。不得自动换成后来cookie对应的新用户，也不得发外部供应商请求/令牌。后端已经单独实现这些API（不由你实现）：

- GET me -> `{user:{id,name,admin:false}}`，无有效cookie401；source boot自动setUser并pullState，不要guest。
- GET config -> invite_only true, allow_guest false, default_lang zh, coach null, media capability。
- GET data -> `{state,rev,wid,projectionWarnings}`（source兼容格式由backend按实际源实现）；GET data/rev -> `{rev,wid}`；PUT data含 `{state,baseRev,wid,...}` CAS；409包含server state。你应保留source既有CAS逻辑。
- 私有媒体 missing / PUT hash / GET hash / sweep，实际协议backend按source实现；只上传到本站。必须让img/video通过已认证blob loader，不能因为tag不能加header而省略账户绑定。
- 工作台自己的login/logout/passkey/server pairing/admin/token页面不要展示，账户管理回到Forma；me cookie已经authenticated。403/401明确告诉用户回Forma重登，不要切换guest。sourceSettings中密码/邀请/令牌/远端服务器入口隐藏。
- root将从数据接口读取projectionWarnings并说明：合法但Forma摘要不能表达的记录完整保留于工作台。

## 同源隔离（必须实现）

iframe只隔离CSS/hash，不隔离持久存储。使用初始account为所有工作台localStorage/sessionStorage键、IndexedDB库名和私有cache/BroadcastChannel增加 `forma-workbench:<account>:` 命名空间，不能读取现有openGym gym_state_v1或别的Forma账户缓存。source已有owner/stash仍保留；storage事件跨标签同步应剥离/识别自身prefix，不能处理别账户事件。实现单独bootstrap先于App导入执行，确定lang不读其他账户旧值。不能把account写入新用户id请求体作为信任源。

删除/禁用source自身SW注册和media-prefetch（原activate会清掉所有同源cache）。不要带public/sw.js进产物；仅root Forma离线壳管理自己。后台push/原生HealthConnect/HealthKit/商店/条码/手机原生设置不显示成已实现。保留浏览器内本地休息声/震动（用户触发后）及屏闪。

## 能力和事实规则

- 不展示未配置AI聊天教练/供应商密钥入口，移除Coach路由/导入依赖或提供明确不可用返回；不能把source API key输入框放到客户端。无需复制api/coach server。有动态纯coach/core引用影响build时可删未使用路由/引用，或在vendor范围复制必要纯函数并明确禁用AI调用；原始source只读。
- source疲劳/保留力量/恢复分数和StructuralBalance评价不能作为健康分数或诊断；保留真实训练量/负重/公开比例对照并用明确“模型参考”文案，隐藏发明健康分数和自动恢复/弱链结论。缺记录显示—。
- 当前本区可用5632主动画/海报，路径 `/exercise-media/opengym/clip/<id>.mp4` 和still `<id>.webp`。通过Vite env VITE_GIF_BASE和VITE_IMG_BASE指向这些路径。female922替代画法没有stage，不展示该选项或固定用主媒体避免404（人体图male/female几何均可保留）。不会下载/热链第三方媒体。
- 来源public的demo数据不能自动填充新账户；空账户为空。演示若保留需明确标注。

## 构建

新增 `scripts/build-training-workbench.mjs` 调用vendor/frontend自己的Vite，以同目录package-lock/依赖为准，base './'，输出到根 `dist/training-workbench`，禁止emptyOutDir清空根dist。root会在主vite build后调用此脚本。不需原生Capacitor构建，不升级Forma的React/Vite版本。不引入telemetry。定义source所需__APP_VERSION__等常量，读取自己vendor package。独立config可写vendor/frontend/vite.config.js。不要把SW、源码.env、DB、test-fixture复制到产物。

运行你新增的构建脚本验证；npm ci由root已执行，若仍在安装等其完成，不改package版本。将真实结果、仍缺契约/功能、修改文件和任何测试限制记录到你自己的status。不能声称完成未验的浏览器功能，测试由root最终完成。最终反馈简短说明结果和风险。
