# 第一期聊天记录：依赖拆解与04/06交付输入（02草案）

- 起草：02 claude-lead，2026-10-24。依据：FORMA §1“新增范围”和§3；origin/main 0aa698d（02只读`git show`核对过路由、类型和导出，没有运行）；SparkyFitness参考副本30d40b75。
- 状态：草案，供01登记CHAT-*时参考。不是正式任务，不派工。
- 第一期范围（用户已定）：聊天记录、草稿卡片一键保存、聊天识图、聊天历史。第三方接入沿用01的HEALTH-*，MCP不做。

## 1. 现有能力（origin/main，可直接复用）

| 能力 | 位置 | 聊天怎么用 |
|---|---|---|
| 登录与账户 | AUTH-*，`server/app.ts`的`auth`中间件 | 聊天接口沿用会话，不从请求体取用户 |
| 记录写入 | 客户端`AppState` + `POST /api/sync`（`SyncMutation`，带`baseVersion`）；集合包括meals、workouts、sleeps等 | **建议**：服务端只返回草稿卡片；用户确认后，由前端走现有的`RecordDraft`和sync写入。这样不新增写入路径，和手动记录用的是同一套代码 |
| 拍照识别 | `POST /api/food-photo-drafts`（需`consent:true`；jpeg/png/webp，不超过5MB）→ `FoodPhotoDraft`；前端`foodPhotoReview.ts`可改克数和份数 | 聊天识图直接调这个接口，不另做识图 |
| 健康数据 | `server/health/`（ledger、model、providers、service、router），含步数、睡眠、心率等第三方记录 | 查询类问题只读；聊天不写第三方记录 |
| AI错误与限额 | `server/ai-errors.ts`；`.env.example`里的`FORMA_AI_*`（每日次数、单次预留费用、每日费用上限、超时、重试） | 聊天沿用同一套错误和成本控制 |

## 2. 需要新做

| 内容 | 建议owner | 依赖 |
|---|---|---|
| 聊天API、意图分类、9类工具的注册与输出格式、草稿卡片结构 | 01定契约（`src/types.ts`、`src/api.ts`）；05实现 | CHAT-PRODUCT |
| 聊天历史存储、四档自动清理（默认从不）、纳入导出和删除账户 | 05 | CHAT-CONTRACT |
| 聊天界面、草稿卡片、可点选项、历史设置 | 04 | CHAT-CONTRACT |
| 独立审查 | 06 | 同一候选SHA |

## 3. 9类工具和现有数据的对应

| 类别 | 现有数据 | 第一期建议 |
|---|---|---|
| 饮食 | meals、拍照草稿 | 做：记录（草稿）+ 查询 |
| 训练 | workouts、routines、训练工作台投影 | 做：记录（草稿）+ 查询 |
| 身体数据 | sleeps；体重、心情、断食不在`SyncCollection`里 | 睡眠做；体重、心情、断食需要01新增集合，建议放第二期 |
| 步数 | `server/health`的第三方或HealthKit记录 | 只做查询；手动步数需要新集合 |
| 目标、报告 | planVersions、reports | 只做查询 |
| 教练建议 | suggestions（确定性规则） | 只引用现有规则的结果，LLM只负责措辞 |
| 识图 | food-photo-drafts | 做 |
| 个人资料 | profile | 只做查询；修改走设置页 |
| 用药 | 没有对应数据 | 第二期，且只记录 |

需要03和01确认第一期范围，尤其是体重、心情、断食、手动步数要不要现在就新增集合。

## 4. 给04的输入（CHAT-CONTRACT登记后生效）

- 可写路径按TASKS：`src/features/`、`src/components/`、`src/styles.css`。不改`src/api.ts`、`src/types.ts`。
- 草稿卡片复用`mealEditor`、`recordDraft`、`foodPhotoReview`的编辑和确认逻辑。确认之前不写入任何数据。
- 可点选项（候选食物、克重换算）点一下等于发出一条用户消息，不直接写数据。
- 设置页加聊天历史清理四档，默认“从不”；中英双语；缺失值显示`—`。
- 交付：候选SHA、`npm run build`、浏览器自测截图（桌面与手机宽度）。

## 5. 给06的验收清单（CHAT-REVIEW）

1. 没有用户确认就不写入任何记录，包括聊天识图。
2. 聊天历史按账户隔离；换账户后看不到别人的历史。
3. 四档自动清理都生效，默认“从不”；导出包含聊天历史，删除账户时一并删除。
4. 日志和错误信息不回显聊天内容、图片或健康数据。
5. 缺少AI密钥时返回清晰错误，不崩溃；超时、限额与现有AI一致。
6. 图片类型和大小限制与`/api/food-photo-drafts`一致；之后的对话不再重发旧图片。
7. 查询本人数据时，回答与实际记录一致；查不到就说查不到，不编造。
8. 教练建议只来自确定性规则；用药类不给建议。
9. 中英文界面与错误都完整。

## 6. SparkyFitness可参考的部分（已获用户声明授权，复用前须记reuse-log并经01同意）

| 参考点 | 位置 | 说明 |
|---|---|---|
| 意图分类与按类加载工具 | `SparkyFitnessServer/services/chatService.ts`（`classifyUserIntent`）、`ai/tools/metaTools.ts`、`ai/tools/index.ts` | 可借鉴分类和按需开启的做法 |
| 可点选项 | `ai/tools/askTools.ts` | 和Forma的澄清规则一致 |
| 历史清理 | `models/chatRepository.ts`、用户偏好`auto_clear_history` | 四档清理的参考 |
| 上下文窗口 | `chatService.ts`的`buildLlmWindow`、`stripHistoricalImages` | 按预算截断、不重发旧图 |

不能照搬的：它的系统提示词要求“说了就记”，与Forma的草稿规则冲突；它的技术栈（PostgreSQL、RLS、Vercel `ai` SDK）和Forma不同，引入新依赖由01决定。

## 7. 待决定

- 03：第一期包括哪些记录类型、草稿卡片的交互细节、查询回答的格式。
- 01：是否引入AI SDK或沿用现有OpenAI适配；是否用流式输出；新增集合。
- 用户：聊天用的AI供应商与单用户成本上限。
