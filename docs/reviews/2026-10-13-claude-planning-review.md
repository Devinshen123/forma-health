# Claude Code 独立评审与规划补充 v0.1

- 日期：2026-10-13 22:20 PDT
- 作者：Claude Code（本机交互会话，Opus 5.5），不是此前那次只看简报、禁用工具的 `claude -p` 评审
- 状态：**规划阶段的提案**。需由 Codex（lead）整合，并经用户确认。本文不批准任何实现、付费服务或发布。
- 写入范围：本次只新建了本文件和 `docs/collaboration/requests/20261013-2220-claude-to-lead-planning-review.md`。没有修改 `AGENTS.md`、`src/`、`server/`、`docs/predevelopment/`、`docs/research/` 或 `reference-sources/`。
- 与 Codex 文档的关系：Codex 已完成的工作（`docs/research/*`、`docs/predevelopment/2026-10-13/decisions-prd.md`、`source-reuse.md`）**不在这里重复**。本文只写我独立核实的证据、发现的冲突，以及 Codex 文档里还没有的交付物。

标注说明：
- **[核实-C]**：Claude 本轮亲自读源码、运行命令或用浏览器观察到的。
- **[核实-X]**：Codex 已核实、我抽查后同意的。
- **[建议]**：我的设计建议。
- **[需核实]**：法规、平台政策或价格类判断，我没有逐条查证当前版本。
- **[待决]**：需要用户决定。

---

## 0. 摘要（先读这一节）

1. **两个 Codex 线程对“能否开始实现”说法相反。** `AGENTS.md` 写“先做网站（用户已授权）”，并且已经有原型代码；`docs/predevelopment/2026-10-13/` 的 C08、G01 则写“产品实现仍需人类确认”。请用户一锤定音（见 §2 Q1）。
2. **现有原型能用作 UX 原型，但不宜直接作为跨端产品底座。** 它的三个基础选择与已确认需求冲突：整账户 JSON 快照 API、客户端自己生成建议、邮箱＋密码登录。建议在加功能之前先做一次契约调整（§3）。
3. **复用结论与 Codex 一致**：只有 FudAI（MIT）的代码能进入收费的闭源产品。openGym 与 Mealie 是 AGPL，SparkyFitness 是非商业许可，只能参考。我补充了模块级的移植清单和三处修正（§5）。
4. **差异化建议**：“今日三件事＋证据链”。每条行动都写明哪条规则触发、引用了哪些记录、数据是否完整，用户可以改、换、跳过。计划的每次变动进入可撤销的版本账本。验证愿意使用和付费的办法是 4 周邀请测试，加上“不收费的创始会员预留”（§4.1）。
5. **成本**：邀请期按 50 人估算，每月约 US$25–70，其中 AI 约 US$12–30。Apple 开发者会员 US$99/年另计（§9）。
6. **外部硬依赖**：Apple Developer Program（会员身份类型会影响审核，§2 Q5）、发送邮箱验证码所需的域名或发信方案、营养师审核安全规则、隐私/法律审阅。
7. **项目隔离**：`C:\Users\devin\AGENTS.md` 是 Showroom AI（家具项目）的指令。Claude Code 在本目录下仍会自动加载它。本目录 `AGENTS.md` 已写明忽略它；更稳妥的做法是把它移到 `showroom design/` 目录（需用户同意，因为会改动另一个项目）。

---

## 1. 我实际核查了什么

| 对象 | 方法 | 结论 |
|---|---|---|
| 四个参考仓库的许可证 | 读取 LICENSE、NOTICE、package.json | [核实-C] FudAI MIT；openGym AGPL-3.0，另含 App Store 分发例外和 CLA；Mealie AGPL-3.0；SparkyFitness 为自定义非商业许可，且第 6 条要求贡献者转让权利，server 的 package.json 却写 ISC，以根 LICENSE 为准 |
| FudAI iOS 源码 | 读 Stores、Models、Services、Views 和提示词 | [核实-C] 数据存于 UserDefaults JSON blob（全仓 282 处引用），照片存在 Application Support；AI 在设备端直接调用（BYOK）；HealthKit 读写体重、身高、体脂、营养、活动能量、步数、workout，**没有睡眠、HRV 和静息心率**。与 [核实-X] 一致 |
| FudAI 提示词 | `Services/GeminiService.swift` | [核实-C] 营养素缺失时多数提示词写的是“use null”（L325、346、417、466）；只有补剂类成分（肌酸、牛磺酸等）写的是“otherwise use 0”（L216）。份量以克为准，单位选项满足 quantity × grams_per_unit ≈ serving_size_grams；没有置信度字段 |
| FudAI 本地化 | 统计 `Localizable.xcstrings` | [核实-C] 1,330 个 key 中 474 个有 zh-Hans，约 36%。可以作为起点，但远不完整 |
| FudAI “Health Score” | grep | [核实-C] `OnboardingView.swift:1653` 有 “Health Score” 展示项。**不得移植**，违反“不发明健康分数” |
| FudAI 素材 | ASSET_CREDITS | [核实-C] 训练插画由 FudAI 自绘，运行时从其 CDN 下载；Free Exercise DB 原始 JPEG 未随 App 分发。插画是否也在 MIT 范围内，文件没有写明 → 不复用，也不热链 |
| openGym 动作库 | NOTICE、catalogue | [核实-C] Gym visual 媒体禁止商业复用，也禁止喂给 AI；文本一部分来自 ExerciseDB v1 (AscendAPI) 经 hasaneyldrm 以 MIT 发布，其余文本和全部翻译（含 zh）为 AGPL。**风险**：ExerciseDB 上游的权利链 [需核实]，不建议依赖 |
| 现有原型 | 读 `server/*.ts` 与 `src/*` | [核实-C] 见 §3 |
| LADDER 问卷 | 内置浏览器，375px 宽，逐页走到邮箱页为止 | [核实-C] 见 §12 |
| Cal AI 官网 | 内置浏览器 | [核实-C] 打开约 3 秒后弹出邮箱领取 3 天试用的弹窗；页头有 “Manage Subscription”（说明在网页端管理订阅）。App 内流程未实测 |
| Codex 是否可直接通信 | 检查 PATH、`~/.codex`、会话记录 | [核实-C] `codex` 不在 PATH，Codex 桌面版自带 `codex.exe`。实际在用的协作方式是：Codex 调用 `claude -p` 并保存结果，加上共享目录里的文件。我没有反向调用 Codex，因为那会新开一个 Codex 会话、消耗额度，而且它看不到当前 Codex 线程的上下文 |

---

## 2. 需要用户拍板的问题（按影响排序，附建议）

> 与 Codex 的 D01–D05、G01 对应，避免重复提问。
> **更正**：D01（计费周期）已在 2026-10-14T05:04Z 的 Codex 对话中回答为“约 US$20/月（推荐）”，可从待决列表移除。D03 的回答是“有 Mac（可运行 Xcode）和可测试 iPhone”，**未提到 Apple Developer 会员**，应理解为尚未加入。

| # | 问题 | 我的建议 | 对应 |
|---|---|---|---|
| Q1 | 现在是否开始实现？以哪份代码为底座？ | 批准**网站**实现，但第一个任务是“契约修正”（§3），完成后再加功能；iOS 等 Q5 落定再开工 | G01 |
| Q2 | “中文”是只指语言，还是也要覆盖中国大陆市场？ | 只指语言。MVP 不在大陆分发、不在大陆托管，不做 ICP 和生成式 AI 备案；仅限 18 岁及以上；海外单一区域托管 | D04 |
| Q3 | 健康数据上云和交给第三方 AI 的默认方式 | HealthKit 原始样本留在设备；在单独同意后只上传日汇总（睡眠时段与时长、步数、训练）；AI 只用不拿数据训练的付费 API 条款；化验单文件私有存储、可删除 | D05 |
| Q4 | 邀请期每月服务预算上限 | 每月 US$75 硬上限（含 AI），Apple US$99/年另计；每人每月 AI 上限 US$1.5，每天最多 15 次食物识别 | D02 |
| Q5 | Apple Developer 用个人还是组织身份？何时加入？ | 有公司就用组织身份（需要 D-U-N-S 编号，可能要 1–2 周），iOS 开工前加入。原因：App Review 5.1.1(ix) 要求医疗健康等高度监管领域的 App 由法律实体提交 [需核实当前条文]，化验单解读可能被归入这一类 | D03 |
| Q6 | 邮箱登录的方式 | 6 位一次性验证码（Web 和 iPhone 通用），**不用密码**。注意：发信通常需要可配置 SPF/DKIM 的自有域名；不买域名时只能用发信商的受限方案，邀请规模勉强够用 [需核实具体发信商] | C04 |
| Q7 | AI 供应商 | 在服务端做供应商抽象：识图默认用 Flash 级多模态模型，周回顾和化验单解释用更强的模型。首选有“付费层不用于训练”条款、且支持中文的供应商 [需核实条款] | — |

本轮已向用户提出 Q1–Q5。Q6 默认采用 Codex 也赞成的验证码方案，不单独提问；Q7 依赖 Q2 和 Q3 的答案，放到下一轮。

---

## 3. 对现有原型的架构评审（需 lead 决定，我不改代码）

现状 [核实-C]：
- `server/store.ts`：`node:sqlite` 单文件数据库，表为 `accounts`、`states`、`sessions`、`assets`；**每个账户的全部数据是 `states.state_json` 一个 JSON**，只有一个 `revision`。
- `server/app.ts`：`GET/PUT /api/state` 整体读写；`/api/auth/register|login` 用邮箱＋密码，scrypt 哈希；还有 assets、export、delete account 接口；`/api/capabilities` 如实返回 `ai:false, apple:false, healthkit:false`。
- `server/validation.ts`：用整体快照比较来保证计划版本只追加、不能改写，做法严谨；建议对象 `suggestions` 由**客户端**写入快照，服务端只校验形状和版本关系。
- 写得好的地方：会话令牌只存哈希、按 owner 查询、上传路径防目录穿越、日志不回显健康内容、能力接口如实上报。

| 冲突 | 为什么重要 | 建议的修正 |
|---|---|---|
| 整账户快照 + 单一 revision | iPhone 离线队列和 Web 同时写入时，**任何两个不相关的修改都会互相 409**；HealthKit 批次会把 blob 撑大；每次写入都重写全量；`max(10000)` 迟早触顶 | 改为按实体的资源接口：meals、workouts、sleep、checkins、plan_versions、proposals 各自有 id 和 revision，客户端生成 UUID 作幂等键，提供 `GET /changes?cursor=` 增量同步。快照校验里的不变量移到各服务函数里，并保留现有测试思路 |
| 建议由客户端生成 | 规则、证据引用和措辞都不在服务端，无法审计，也无法保证“理由引用真实数据”；iPhone 端还得再实现一遍 | 规则引擎放在服务端（`server/rules/`，归 rules 角色）；`proposals` 只能由服务端创建；客户端只能 accept/reject/edit/undo |
| 邮箱＋密码 | 已确认的是“Apple 登录＋邮箱”，没有密码。存密码会增加凭据泄露面，也和 Apple 登录的账户关联设计不一致 | 换成邮箱一次性验证码；`auth_identities(provider, subject)` 唯一，为 Apple 预留；邀请码限制注册 |
| 营养总量由客户端提交 | `meals` 里 kcal、宏量由客户端给，服务端只检查是否合理 | 服务端根据“条目 × 克数”确定性计算总量，客户端给的总数仅供展示 |
| 端口固定（3001/5173，strictPort） | 多个 agent 共用一个目录时无法各起一份 dev 服务做验证 | 改由环境变量配置端口，默认值不变（归 lead） |

SQLite 本身不是问题：邀请期单实例、开 WAL、自动备份到对象存储、磁盘加密，这样足够用。要预留迁移到 Postgres 的路径（迁移脚本＋数据访问层）。

**提议**：lead 写 `docs/collaboration/decisions/ADR-001-entity-api.md`，把上述契约修正排为 TASK-001，backend 和 rules 并行实施。UI 原型保留，只替换数据层。

---

## 4. MVP PRD 补充

Codex 的 `decisions-prd.md`（R01–R0x、用户故事）作为 PRD 主体。下面只补它还没有的部分。

### 4.1 差异化与验证

**差异化（建议）：今日三件事＋证据链。**
- 首页每天最多 3 条行动，覆盖饮食、训练、恢复中的若干项。
- 每条行动都有“为什么”卡片：
  - 触发它的规则，例如“近 7 天蛋白质有 5 天低于目标下限”；
  - 证据链接，可以点进具体的餐食、训练或睡眠记录；
  - 数据完整度，例如“7 天中记录了 4 天”；
  - 不确定性说明。
- 每条行动都可以修改、换一个、跳过或暂停。
- 计划的每次变化都写进**版本账本**：先给出前后 diff，用户确认后生效，可以一键撤销，撤销会新建一个版本。
- 数据不足时不下结论，只给保守的可选行动，例如“补记昨天的晚餐？”。

对标：Cal AI 强在记录速度，LADDER 强在教练课程，Eat This Much 强在配餐。我们的位置是**把记录变成透明、可撤销的计划调整**。识别精度不和 Cal AI 硬拼，重点做“快速修正”。

**验证方案（MVP 内不收费）：**
- **人群**：30–60 名受邀用户，以健身人群为主，中英文用户大致各半，测试 4 周。
- **使用指标**：埋点只记录事件名，不记录健康数值。

  | 指标 | 目标 |
  |---|---|
  | 问卷完成后确认计划 | ≥ 60% |
  | 第 4 周每周活跃 ≥ 3 天 | ≥ 35% |
  | 活跃日中完成 ≥ 1 条行动 | ≥ 50% |
  | 建议得到回应（接受、拒绝或修改） | ≥ 50% |
  | 接受后撤销 | < 20% |

  另外跟踪食物草稿的修改率和修改幅度，用来衡量 AI 估算质量。
- **付费意愿**：
  - 第 3 周在 App 内展示“创始会员 US$20/月”卡片，明确写“现在不会收费”，用户可点“预留”。预留率达到第 3 周活跃用户的 ≥15% 视为信号。
  - 退出问卷加入 Van Westendorp 价格四问。
  - 中英文用户各访谈 4–6 人。
- **转向条件**：第 4 周活跃 < 20%，或建议回应率 < 30% → 先重做“今日三件事”的规则和文案，再考虑扩展功能。

### 4.2 核心旅程（端到端验收用）

1. **邀请与登录**：邀请码 → 邮箱验证码（Web）或 Apple 登录（iPhone，Q5 之后）→ 选择语言、单位和时区。
2. **问卷**：约 12–16 题（§12 的 LADDER 观察可作参考）。每页一题、地址可直达、可返回、断点续答、可跳过；敏感字段旁有“为什么问”说明。
3. **计划草稿**：确定性公式先算区间，例如维持热量区间、蛋白质每公斤体重的克数区间、每周训练模板；AI 只写说明文字。用户可以逐项修改，确认后生成 plan v1。
4. **记一餐**：拍照、文字或手动 → 草稿（标为“估算”）→ 逐项修改食物和克数，用快捷份量调整 → 保存。识别失败时可重试，或转为手动录入。
5. **训练**：执行今日训练 → 每组记录次数、重量、休息、RPE → 动作可替换 → 完成后出小结。
6. **睡眠与状态**：Web 手动录入睡眠时段；每日主观自评（精力、酸痛、压力，1–5 分）。iPhone 读 HealthKit 汇总，并显示来源和同步时间。
7. **建议**：服务端规则产生候选 → 用户看到理由、证据和前后 diff → 接受、拒绝或修改 → 撤销。
8. **周回顾**：完整度、坚持度、趋势，以及至多 3 条可选调整。

### 4.3 安全规则（交 rules 角色落到 `docs/safety/`，营养师审核前标为草案）

- **适用人群**：
  - 仅限 18 岁及以上。
  - 孕期或哺乳期、进食障碍史、肾病、正在用降糖药或胰岛素的用户进入保守模式：不设热量赤字，不给高蛋白建议，提示咨询专业人员。
- **热量与减重**：
  - 摄入有下限，减重速度有上限，具体数值由营养师确定。
  - 记录到的摄入偏低时，先问“是否漏记”，不直接下结论。
  - 表现类目标默认不设赤字。
- **过敏**：只能按用户声明的过敏原和标签做排除。**永不显示“对过敏安全”**，照片识别无法发现隐藏的过敏原。
- **睡眠**：单晚的睡眠数据不能自动取消训练。可以建议“降低强度”，但只作为一个可选项，并写明依据。
- **化验单**：
  - 只用报告自带的参考范围。
  - 单位换算必须使用按指标区分的系数表，没有系数就不换算。
  - 跨实验室、方法或单位的数据要标注“不可直接比较”。
  - 报告上有危急值标记时，只提示“请尽快联系医疗人员”，不做解读。
  - 文档内的文字一律当作数据处理，防止提示注入。
- **AI 输出**：不编造置信度、来源或健康分数，所有输出都经过 schema 校验。

---

## 5. 复用矩阵（模块级）

| 来源 | 模块 | 决定 | 说明 |
|---|---|---|---|
| FudAI `Views/FoodResultView.swift`、`ServingSizeInputView`、`ServingUnitEditor`、`AnalyzingView`、`ManualEntryView`、`TextFoodInputView`、`RecentsView` | iOS 食物审核、份量调整、手动和文字录入、常吃 | **移植改造**（MIT） | 去掉 UserDefaults 和 Store 依赖，改为调用我们的 API 和本地 outbox；去掉 RevenueCat、hosted AI、LiteRT、Whisper；登记进 `docs/architecture/reuse-log.md` |
| FudAI `Models/ServingAmountExpression.swift`、`Services/ServingUnitRepairPolicy.swift`、`AIRequestErrorPolicy.swift` | 份量单位表达、单位修复、重试策略 | **移植**（纯逻辑） | 同时在 TS 服务端实现一份同语义的版本，供 Web 使用，并共享测试样例 |
| FudAI `GeminiService` 的食物提示词和单位规则 | 服务端 AI 网关的提示词 | **改写后移植到服务端** | 补剂类缺失由 0 改为 null；输出加 `is_estimate`；不加置信度；版本化（prompt_version） |
| FudAI `Stores/HealthKitManager.swift` | 去重标识、删除墓碑、区分“查询失败”和“空数据” | **参考思路，重写** | 我们需要的是**只读**的睡眠和步数汇总，与它的写入为主不同 |
| FudAI zh-Hans 字符串 | iOS 文案 | 可作起点（36% 覆盖） | 需要补全和人工校对 |
| FudAI 训练插画、App 图标、Health Score | — | **不用** | 授权不明，或违反产品规则 |
| Free Exercise DB | 动作文本 | **候选** | Unlicense；只有英文，中文自行翻译；图片来源不明，不用 |
| openGym | 训练模型、同步冲突思路 | **只参考行为** | AGPL；媒体专有；zh 翻译也是 AGPL |
| SparkyFitness | 仪表盘信息组织 | **只看公开页面和交互** | 非商业许可；不读也不抄 schema |
| Mealie | 食谱和购物清单 | MVP 不做 | AGPL；以后可评估 MIT 的上游库 recipe-scrapers、ingredient-parser |
| USDA FoodData Central | 英文食物营养参考 | **建议**作为 AI 估算的校准数据 | 公共领域 [需核实当前条款]；中文食物成分表多有版权，不能直接使用 |
| Open Food Facts | 条码 | MVP 不做 | ODbL，以后若接入，需遵守署名和相同方式共享 |

**动作库建议**：MVP 自己编写 60–100 个常用动作，中英文说明自写或由 AI 起草后人工审，配简单的自制示意图或不配图。这比整合任何第三方动作库都更干净。

---

## 6. 架构、数据模型、API（只写增量）

基础采用 Codex 的 `docs/research/healthkit-architecture.md` §5（User/AuthIdentity、DeviceConnection、ConsentRecord、HealthObservation、HealthSummary、Report、Recommendation/PlanVersion、SyncOperation/DeletionJob，以及 API 列表），我同意。补充如下：

```
┌──────── Web (Vite+React) ────────┐     ┌──────── iPhone (SwiftUI) ────────┐
│ i18n zh-CN/en · outbox(IndexedDB)│     │ HealthKit 只读 · outbox · 相机    │
└───────────────┬──────────────────┘     └───────────────┬──────────────────┘
                │  OpenAPI 3.1 契约（生成 TS 客户端 / swift-openapi-generator）
        ┌───────▼───────────────────────────────────────────▼───────┐
        │ API (Express 5 + zod)  auth · 资源 CRUD · changes 游标      │
        │ services/ nutrition-core · plan-engine(rules) · ai-gateway │
        ├────────────┬───────────────┬──────────────┬───────────────┤
        │ SQLite→PG  │ 私有对象存储    │ 作业队列       │ AI 供应商(服务端)│
        │ (按 owner) │ 照片/化验单      │ 识图/OCR/周回顾 │ 预算账本+限流   │
        └────────────┴───────────────┴──────────────┴───────────────┘
```

**新增或强调的表：**
- `onboarding_sessions(id, owner_id, questionnaire_version, step, answers_json, updated_at)`：断点续答，问卷有版本号。
- `plans(id, owner_id, current_version_id)`、`plan_versions(id, plan_id, parent_id, created_by enum(user|proposal|undo|onboarding), reason_code, payload_json, created_at)`：只追加，不修改。
- `proposals(id, owner_id, base_version_id, rule_ids[], evidence_refs[], diff_json, explanation_i18n_json, model?, prompt_version?, status, expires_at)`。
- `daily_actions(id, owner_id, local_date, plan_version_id, proposal_id?, kind, status, completed_at)`。
- `food_drafts(id, owner_id, input_kind, asset_id?, model, prompt_version, raw_output_json, validated_json, error_code)` 与 `food_entries(id, owner_id, client_id UNIQUE, consumed_at, tz, meal_type, draft_id?, items_json, totals_computed_json, user_edited bool, revision)`：两张表分开。
- `workout_sessions` 与 `workout_sets(planned_*, performed_*, rpe, rest_s, substitution_of?)`：计划值和实际值并存。
- `daily_health_summaries(owner_id, local_date, metric, value NULL, unit, source, availability enum(ok|missing|denied_or_empty|partial), data_as_of)`：missing 是 NULL，不是 0。
- `checkins(owner_id, local_date, energy, soreness, stress, note)`。
- `ai_usage_ledger(owner_id, feature, model, in_tokens, out_tokens, cost_usd, created_at)`：实时汇总，超过上限就拒绝调用并返回本地化错误。
- `report_items(report_id, analyte_raw, value_raw, unit_raw, ref_range_raw, ref_low?, ref_high?, flag_raw, sample_date, ocr_value, user_value, corrected bool)`：原值和 OCR 值都保留，不做隐式换算。

**API 增量（REST，前缀 `/v1`）：**
- `POST /onboarding/sessions`、`PATCH /onboarding/sessions/{id}`、`POST /onboarding/sessions/{id}/draft-plan`。
- `POST /plans/{id}/versions`（用户直接编辑，需 `If-Match: base_version`）、`POST /proposals/{id}/accept|reject`、`POST /plan-versions/{id}/undo`。
- `POST /food/analyses`（照片或文字 → 草稿，异步）、`GET /food/analyses/{id}`、`POST /food-entries`（带 `draft_id` 和用户修改）、`GET /food-entries?date=`、`GET /frequent-meals`。
- `GET /exercises?q=&locale=`、`POST /workout-sessions`、`PUT /workout-sessions/{id}`。
- `POST /checkins`、`POST /sleep/manual`、`POST /sync/health/batches`（iOS）。
- `GET /today?date=&tz=`：返回行动、理由、证据和完整度。
- `GET /weekly-reviews/{iso_week}`。
- `GET /changes?cursor=`：跨端增量同步。

错误统一为 `{code, retryable, message_key, params}`，客户端按语言渲染，服务端不在错误里回显健康内容。

**跨设备同步需要新增的东西**（相对现在的原型）：
- 实体级 revision 与客户端 UUID 幂等键；
- `changes` 游标；
- 设备注册；
- 每个设备一个 outbox；
- 冲突时返回 409 和服务端当前版本，由 UI 让用户选择；
- 账户切换时清空本地缓存和队列；
- 删除操作要传播到所有端（墓碑）。

---

## 7. 页面清单

| # | 页面 | Web | iPhone | 备注 |
|---|---|---|---|---|
| 1 | 欢迎、邀请码、登录 | ✓ 邮箱验证码 | ✓ Apple＋邮箱 | Apple 登录等 Q5 |
| 2 | 问卷（12–16 步） | ✓ | ✓ | 进度条、返回、续答、跳过、“为什么问” |
| 3 | 同意中心（首次） | ✓ | ✓ | 按用途分别同意：云同步、AI 处理、化验单 |
| 4 | 计划草稿审阅与确认 | ✓ | ✓ | 逐项编辑，显示理由和未知项 |
| 5 | 今日（首页） | ✓ | ✓ | 三件事、为什么、完整度、数据新鲜度 |
| 6 | 拍照或选图 | ✓ 文件、相机 | ✓ 相机、相册 | |
| 7 | 文字记一餐、手动录入 | ✓ | ✓ | |
| 8 | 识别中、失败、重试 | ✓ | ✓ | 失败时可转手动 |
| 9 | 食物审核编辑 | ✓ | ✓ | 克数、快捷份量、宏量、“估算”标签 |
| 10 | 当日饮食与历史、常吃 | ✓ | ✓ | |
| 11 | 今日训练与动作详情 | ✓ | ✓ | 说明、替代动作 |
| 12 | 训练进行中（组、休息计时、RPE） | ✓ | ✓ | |
| 13 | 训练历史与进阶图 | ✓ | ✓ | |
| 14 | 睡眠手动录入、每日自评 | ✓ | ✓ | |
| 15 | HealthKit 连接与状态 | 说明页 | ✓ | 显示来源、时间戳，以及“读取权限无法确认”的提示 |
| 16 | 建议详情（理由、证据、diff） | ✓ | ✓ | 接受、拒绝、修改，撤销提示 |
| 17 | 计划编辑与版本账本 | ✓ | ✓ | 暂停、恢复 |
| 18 | 趋势（日、周）与指标详情 | ✓ | ✓ | 定义、单位、来源、局限 |
| 19 | 周回顾 | ✓ | ✓ | |
| 20 | 化验单上传、处理、校对（左右对照原件）、详情、单项趋势 | ✓ | ✓ | 功能开关，放在后段 |
| 21 | 通知设置 | ✓ 邮件摘要（可选） | ✓ 推送 | 分类别、频率 |
| 22 | 设置：语言、单位、时区、账户、导出、删除、来源管理 | ✓ | ✓ | |
| 23 | 离线、同步状态提示 | ✓ | ✓ | |

---

## 8. Codex / Claude 分工建议

沿用 `AGENTS.md` §4 的角色和路径。按角色分工如下：

| 角色 | 建议执行者 | 理由 |
|---|---|---|
| lead（含契约、集成、验收） | Codex | 与用户的需求沟通最多 |
| backend | Codex | 与契约同在一侧，减少请求往返 |
| rules（`server/rules/`、`docs/product|safety|rules/`） | **Claude Code** | 规则引擎、营养计算纯函数、安全文案、中英文规则说明，边界清楚、测试友好 |
| shell + features | Codex 或 Claude | 两边都可以；若 Claude 做 rules，前端优先给 Codex，减少契约往返 |
| qa（`tests/`、`docs/reviews/`） | **Claude Code** | 用内置浏览器做 375px 和 1440px 截图、端到端走查。注意：rules 的代码由 lead 评审，避免自己审自己 |
| ios（等 Q5 之后） | **Claude Code，在 Mac 上运行** | 移植 FudAI 的 Swift 模块；只通过 OpenAPI 契约对接后端 |

- 工作区：建议每个 agent 用一个 git worktree（`../forma-<role>`）。端口改为可配置之后，才能各自跑验证。
- 本轮的事实：我没有自领任何角色。本文件放在 `docs/reviews/`（qa 路径）下，属于“独立评审”产物；如果 lead 另有安排，可以移走。

---

## 9. 成本估算

所有价格都是按 2025–2026 年公开价目的量级估算，**实施前按当天价目复核**。

**邀请期（≤ 50 人）每月：**

| 项 | 估算 | 假设 |
|---|---|---|
| 应用主机（单实例，带持久盘） | US$5–15 | Express＋SQLite 单实例；平台子域作为测试地址 |
| 对象存储与备份 | US$1–5 | 照片压缩到约 200KB，原图保留 90 天 |
| 发信 | US$0–20 | 免费额度通常够用，但可能需要域名（Q6） |
| 错误监控、日志 | US$0 | 免费层，并过滤健康内容 |
| AI | US$12–30 | 见下 |
| **小计** | **约 US$25–70** | 不含 Apple US$99/年、Mac、iPhone 和人工 |

**AI 单价**（每个活跃用户每月）：
- 识图：每次约 2–3k 输入、0.3–0.6k 输出 token，Flash 级模型 ≈ US$0.0003–0.003/次；每月 75 次 → US$0.02–0.25。
- 每日建议措辞：规则先出结构化理由，LLM 只润色，约 US$0.03–0.1。
- 周回顾：用更强的模型，每次 ≈ US$0.02–0.05，每月 4 次 → US$0.06–0.2。
- 化验单：每份 ≈ US$0.03–0.08，按每月 1–2 份计。
- **合计约 US$0.25–0.6/人/月**。硬上限设为 US$1.5/人/月，超过后只能手动录入。

**以后 1,000 名付费用户、US$20/月**：
- 毛收入 US$20k；商店抽成 15–30% [需核实小型企业计划资格]；
- AI US$250–600；托管与存储 US$100–300（届时迁移到 Postgres）。
- 主要风险不在 AI 单价，而在拍照频率失控和照片存储。

**一次性/外部**：Apple US$99/年；营养师审核安全规则（几小时咨询）；隐私政策和条款的法律审阅；商标检索（“Forma”这个名字还没查）。

---

## 10. 验收标准、依赖与风险

**端到端验收**（每条都要在中文和英文下各跑一次）：
1. 新账户的问卷中途关闭页面，重开后从断点继续；返回修改答案后，计划草稿随之更新。
2. 计划确认前不生效；确认后得到 v1；修改得到 v2，diff 正确。
3. 拍照识别成功：草稿标“估算”；把克数从 200 改为 150 后，所有营养值由服务端按比例重算；保存后历史中可见。
4. 识别超时或输出不合法：显示可重试的错误，可以转手动录入，**不会**保存半成品。
5. 训练：记录 3 组，替换 1 个动作；小结和进阶图正确；RPE 可以为空。
6. 睡眠：手动录入跨午夜 23:30–07:00，按醒来日期归档；当天没有记录时显示“—”，不显示 0；周平均标注“7 天中记录了 4 天”。
7. 建议：触发规则后看到理由、证据链接和 diff；接受后计划更新；撤销后生成恢复版本，已记录的餐食和训练不受影响；在过期的 base 上接受 → 409。
8. 周回顾：完整度、趋势和至多 3 条可选调整；数据不足时明确说明。
9. 隔离：账户 A 的 id、资产 URL、导出内容在账户 B 的会话下全部返回 404 或 403。
10. 删除账户：数据库记录、对象文件、会话全部清除；旧链接失效。导出文件包含全部原始记录和计划版本。
11. iOS（后期）：拒绝 HealthKit 授权或数据为空时，显示“无法确认读取权限或暂无数据”，不显示 0；两个来源重叠时不重复计数；离线时记录，联网后同步；A 退出、B 登录后，A 的队列不会上传。
12. AI 预算：超过上限后返回本地化提示，手动记录不受影响。

**依赖**：Apple Developer（Q5）；Mac 上的 Xcode 版本和真机型号（未核实）；发信域名（Q6）；AI 供应商账号与条款（Q7）；营养师；法律和隐私审阅；托管账号（不需要买域名）。

**主要风险**：

| 风险 | 缓解 |
|---|---|
| 两个 Codex 线程指令冲突，导致返工 | Q1 定一份权威文件；`docs/predevelopment` 与 `AGENTS.md` 的冲突条目由 lead 合并 |
| 快照 API 延续到 iOS | 先做 §3 的契约修正 |
| 个人开发者账号被以“健康类”拒审 | Q5，组织身份；化验单放在功能开关后 |
| AI 识别偏差（中餐混合菜） | 重点做快速修正；跟踪修改率；明确标为“估算” |
| 健康数据合规（GDPR 特殊类别、美国州法如 WA MHMDA）[需核实] | 按用途分别同意、最小上传、可导出可删除、上线前法律审阅；邀请期限定地区 |
| 动作库或媒体侵权 | 自写动作库；不用 openGym 和 FudAI 的媒体 |
| 进食障碍、低能量风险 | §4.3 的安全规则和营养师审核 |
| “Forma”商标冲突 | 上线前检索；代码里用中性的内部代号 |

---

## 11. 真实功能 / 演示 / 外部依赖（当前状态）

| 能力 | 当前状态 [核实-C] |
|---|---|
| Web 账户（邮箱＋密码）、快照存储、导出、删除 | 原型代码存在。22:2x PDT 我运行了 `npm test`：**10/10 通过**（临时目录、随机端口，不碰共享数据）；`npx tsc --noEmit` 退出码 0。没有运行 `vite build`（会写 `dist/`），也没有启动 dev 服务（避免占用固定端口）。测试通过说明原型自身一致，**不等于**已确认的产品方案 |
| AI 识图、文字识别 | **没有**（`/api/capabilities` 返回 `ai:false`） |
| Apple 登录、HealthKit、iPhone App | **没有**；需要 Apple Developer 和 Mac |
| 化验单 OCR | **没有**；原型只有 markers 字符串字段 |
| 规则引擎、周回顾 | 原型只有客户端生成的 suggestion 结构；没有服务端规则 |
| 演示数据 | `src/demo.ts` 存在，必须标注“演示数据” |
| 部署和测试 URL | **没有** |

---

## 12. 参考产品观察（已观察 / 推测 / 我们的设计）

**LADDER 问卷**（2026-10-13，内置浏览器，375×812）[核实-C]：
- 共 27 步，地址形如 `?page=N`，刷新或返回都能回到原处。
- 进度条有 `role=progressbar` 和 aria-valuenow。
- 每页一题。单选题选中即自动前进；多选题（如“偏好的训练类型”）需要点 Continue。
- 实际问题约 16 个，顺序是：是否有 iPhone/iPad → 是否已有心仪教练 → 目标（9 项，每项都写结果和副标题，例如“Lift heavier: set new personal records”）→ 目前每周练几天 → 其中几次举铁 → 力量训练经验 → 年龄段 → 性别（含 Non-binary 和 Prefer not to say）→ 偏好类型（多选）→ 每次可用时长 → 训练场地 → 是否用过训练 App → 是否戴 Apple Watch。
- 每 3–4 题插一页“信任理由”或用户评价，共约 9 页。
- 第 17、21、24 页被跳过 → 推测存在按答案的条件分支。
- 第 26 页要求填邮箱才能看结果。我在这里停下，没有提交。
- **没有问**伤病、饮食、过敏和睡眠。
- 对我们的启发 [建议]：
  - 沿用“地址可直达＋一题一页＋自动前进＋可访问的进度条”；
  - 早问设备情况，以决定走 HealthKit 还是手动录入；
  - 结果写成可被追究的承诺，而不是评价；
  - **不做**邮箱墙。我们是邀请制，先登录再答题，答案保存到服务端；
  - 伤病和过敏放在单独一屏，附“为什么问”说明；
  - 用户评价类页面在邀请期没有真实素材，不做。

**Cal AI 官网** [核实-C]：首页约 3 秒后弹出“Claim your 3-day free trial”和邮箱输入框；页头有 “Manage Subscription”；宣传图展示扫描模式（Scan Food、Barcode、Food label、Library）和结果卡（份量步进、Fix Results / Done）。
- [推测] 采用网页获客加订阅的路线；App 内的修正流程未实测。
- 对我们的启发：结果页只放一个主操作（保存），修正入口要显眼。

**未做**：没有安装 App，没有抓取 App 内接口，没有绕过任何登录或付费墙。REA（reverse-engineer-anything）技能已在 Codex 中安装，但它需要单独的 rea-agents MCP 和分析引擎；我们的对象是开源仓库和公开网页，不需要它，因此未在 Claude 侧安装。

---

## 13. Skills 记录

| Skill | 来源 | 用途 | 状态 |
|---|---|---|---|
| vercel-react-best-practices | vercel-labs/agent-skills（约 32k★，MIT） | React 性能与代码规范 | **已安装**，项目级，`.claude/skills/` 与 `.agents/skills/`，`--copy` |
| swiftui-pro | twostraws/SwiftUI-Agent-Skill（Paul Hudson，约 5.9k★，MIT） | SwiftUI 评审：可访问性、本地化、HIG | **已安装**，项目级 |
| healthkit | dpearson2699/swift-ios-skills（约 1.2k★，许可证 NOASSERTION） | HealthKit 授权、查询、后台送达、常见错误 | **已安装**，项目级；只读 md，无脚本 |
| i18n-expert | daymade/claude-code-skills（约 1.5k★，MIT） | zh-CN/en 键值、对等检查 | **已安装**，项目级；附带的 `i18n_audit.py` 已审阅，只做本地静态分析，无网络和删除操作 |
| reverse-engineer-anything | morluto/rea（3.5k 次安装） | 二进制和包分析 | Codex 已有；Claude 侧**未安装**，理由见 §12 |
| 已存在、本轮使用或可用 | 全局 `~/.claude/skills` | find-skills、grilling、apple-design、frontend-design、tdd、security-review、database-migrations、playwright、domain-modeling、cost-aware-llm-pipeline | 已有 |

安装记录在 `skills-lock.json`（由 `npx skills` 写入）。这些 Skill 都是开发辅助，**不能替代**营养或医学方面经过验证的知识。

---

## 14. 设计稿 `docs/design/dashboard-concept.png` 的意见

- 周柱状图把没有训练的日子画成 “0”。如果那天是“未记录”而不是计划内的休息日，应显示空柱加“—”，并标注完整度。
- “昨晚睡眠 7h 32m” 缺少来源（手动还是 Apple Health）和时间戳，需求 F 要求显示这两项。
- “让计划跟着你调整”卡片有建议，但没有“为什么”和证据，这正是差异化所在，建议加一行理由和证据链接。
- 导航同时显示中英文（“今日 / Today”），正式版应该按所选语言只显示一种。
- “2/3 今日行动”的进度环是坚持度计数，不是健康分数，可以保留。
