# AGENTS.md — Forma（健康网站）

> 本文件是本目录唯一的项目指令，对所有 agent 生效。
> 如果你同时看到上级目录 `C:\Users\devin\AGENTS.md`（AI 家具设计提案网站：FastAPI、Next.js、SQLite、Gemini、SKU 推荐），那是另一个项目，**全部忽略**，以本文件为准。

## 1. 产品

- Forma：面向全球用户的健身表现与长期健康习惯产品，中英双语。
- 差异化：把饮食、训练、睡眠记录变成少量可解释、可编辑的每日行动。
- 主流程：渐进式引导 → 用户确认计划 → 饮食记录（拍照 / 文字 / 手动，保存前用户可改食物、份量、宏量）→ 训练记录 → 睡眠与状态（Web 手动；iOS 以后接 HealthKit）→ 调整建议（理由 + 前后 diff）→ 接受或撤销 → 周回顾。化验单是后期小切片，放在功能开关后面。
- 当前阶段：先做网站（用户已授权）。iPhone、HealthKit、Apple 登录尚未实现，网站不能把它们展示成已完成的能力。
- 用户已确认的事项：先做网站；以后定价约 US$20/月（现在不做支付）；已有 Mac 和 iPhone。Apple Developer 会员还没确认。
- 分发：邀请制 Web。不做支付、Android、聊天教练、社交、条码扫描。
- 现有代码：目录里已经有一版单 agent 写的实现（`server/app.ts` 快照式 `/api/state`、`src/App.tsx`、`src/features/*.tsx`）。在它的基础上迭代，不要整体重写；需要大改先写请求给 lead。
- 背景资料：`docs/research/`（源码复用与 HealthKit 研究）、`docs/collaboration/claude-review-response.json` 的 `result` 字段（上一轮架构评审）、`docs/design/`（设计规格与参考图）。

## 2. 技术栈（以 package.json 为准）

- 前端：Vite + React 19 + TypeScript，lucide-react 图标，手写 CSS（`src/styles.css`）。
- 后端：Express 5 + cookie-parser + zod，通过 `node --import tsx` 运行。
- 测试：`node:test`（`npm test`）。
- 命令（PowerShell）：
  - `npm run dev`：API 在 127.0.0.1:3001，Vite 在 127.0.0.1:5173，`/api` 走代理
  - `npm run build`：`tsc --noEmit` + `vite build`
  - `npm test`
- dev 服务的端口是固定的（strictPort），同一时间只能跑一份。启动前先检查是否已在运行；已在运行就直接用，不要结束别人的进程。
- 新依赖、npm 脚本、tsconfig、vite 配置的修改都由 lead 负责；`npm install` 也只由 lead 执行。

## 3. 不可违反的规则

### 产品与安全

- 不发明健康分数；不从相关性推断因果；不做诊断、用药、长寿方面的承诺。
- 没记录不等于没吃；没有设备样本不等于 0。缺失值显示 `—`；聚合时排除未记录的天，并标注完整度，例如"7 天中记录了 4 天"。
- 不默认激进的热量赤字；表现类目标默认不设赤字。
- 演示数据必须明确标注"演示数据"；新账户是空状态。

### AI 与确定性代码

- AI 只出草稿和措辞。营养计算、单位换算、聚合、过敏约束、权限检查一律由确定性代码完成。
- 每个 AI 输出都要过 zod 校验，经用户审核后才能保存。
- AI 只在服务端调用，密钥只来自环境变量。缺少密钥时返回清晰的错误，不能崩溃。超时、重试、限流、单用户成本上限都要有。
- 建议引擎：由确定性规则产生候选建议和结构化理由（引用具体的数据点），LLM 最多负责措辞。

### 数据

- 用户身份只从会话推导，绝不信任请求体里的 `user_id`。所有数据按账户隔离。上传文件私有，并限制大小和类型。
- 原始记录和 AI 建议分开存储。
- 计划版本只追加不修改。接受建议时服务端校验 base 版本，不一致返回 409。撤销等于新建一个恢复版本：不删历史，也不改已经记录的饮食和训练事实。
- 支持导出数据和删除账户。日志和错误信息里不回显健康内容、密码、cookie。

### 许可证

- `reference-sources/` 只用来参考，不能修改。
- 不复制 SparkyFitness（非商业许可）、Mealie 和 openGym（AGPL）的代码、schema、UI、图片。openGym 的动作图片和动画一律不用。
- FudAI（MIT）的片段如果要采用：先在 `docs/architecture/reuse-log.md` 里记录来源路径、commit、改动、许可证，并经 lead 同意。

### 设计

- 遵循 `docs/design/design-system.md`（颜色、字号、圆角、布局、首屏文案白名单、减少动态）。参考图是 `docs/design/*.png`。
- 不复制 Cal AI 或其他任何品牌的素材。

## 4. 文件所有权（每条路径只有一个写入者）

| 角色 | 可写路径 |
| --- | --- |
| lead（总控 / 架构） | `AGENTS.md`、`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`scripts/`、`.gitignore`、`src/types.ts`、`src/api.ts`、`docs/architecture/`、`docs/collaboration/TASKS.md`、`docs/collaboration/decisions/`、`docs/collaboration/agent-prompts/` |
| backend（后端） | `server/`（不含 `server/rules/`）、`.env.example` |
| rules（领域规则与安全） | `server/rules/`、`docs/product/`、`docs/safety/`、`docs/rules/` |
| shell（前端外壳与设计系统） | `src/App.tsx`、`src/main.tsx`、`src/styles.css`、`src/demo.ts`、`src/components/`、`src/i18n/`、`index.html`、`public/` |
| features（业务页面） | `src/features/`（现有平铺文件如 `Dashboard.tsx`、`Nutrition.tsx`，以及以后新增的页面） |
| qa（测试与评审） | `tests/`、`docs/reviews/` |

- 每个角色还拥有自己的状态文件 `docs/collaboration/status/<角色>.md`。
- 只改自己路径下的文件。需要别人改东西，就按 §5 写请求。别人代码里的 bug 也写请求，不要直接改。
- 其他路径一律只读。
- 如果实际目录和上表不符，以 `docs/collaboration/TASKS.md` 顶部的所有权表为准（由 lead 维护）。

## 5. 协作协议

- **任务板**：`docs/collaboration/TASKS.md`，只有 lead 写。每个任务都要写明：ID、owner、状态（todo / doing / blocked / review / done）、依赖、涉及的文件、验收标准。
- **状态**：每完成一步或遇到阻塞，就更新自己的 `status/<角色>.md`，写明：正在做什么、已完成什么（附验证命令和结果）、阻塞项、发出的请求。
- **请求**：新建 `docs/collaboration/requests/<YYYYMMDD-HHmm>-<from>-to-<to>-<slug>.md`，写清问题、期望的改动、原因、验收方式。接收方处理完后在文件末尾追加 `## 回复`，写处理结果或拒绝理由。其他人不改这个文件。
- **契约变更**（`src/types.ts`、`src/api.ts`、API 路由形状）：提请求给 lead。lead 改完后在 `docs/collaboration/decisions/` 记录决定，并在 TASKS.md 里通知受影响的角色。
- **开工前**：读本文件、TASKS.md、自己的 status 文件、发给自己的请求。不确定就停下来写请求，不要猜。
- **提交**：仓库是 git 时，每完成一个任务，只 `git add` 自己所有权内的路径并提交，提交信息以 `[角色]` 开头，例如 `[backend] add session auth`。不要 `git add -A`，不要改写历史，不要 force push。
- **完成的定义**：
  - 自己的验收标准通过；
  - `npm run build` 不因你的文件报错；
  - 动了 `server/` 就要跑 `npm test`；
  - 在 status 里贴出命令和结果。

  没有实际运行过的东西，不要写"已完成"。
- **需要用户拍板的事**（市场、预算、供应商、法律）：写进 `status/<角色>.md` 的"待用户决定"一节，不要替用户决定。
