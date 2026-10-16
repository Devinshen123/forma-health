# features 状态

## 2026-10-16 L-03 本地隔离安全修复

- 同日复审补修：新增 `sleepEditor.ts`，睡眠在 open 时固定 draft id/createdAt，`existing` 仅用于标题；提交使用原身份并按当前 state 的实际 ID upsert。已接受但丢失响应后，原新草稿重试能更新同一条，重叠检查排除自身，不再误报；其它记录严格按 ISO 瞬间检查，端点相接和 DST 两次重复钟点的独立区间允许。Nutrition 的 draft id/createdAt 改为必需值，AI 审核也使用 draft.createdAt，避免重试重写创建时间。
- 补修验证：`node --import tsx --test tests/editor-lifecycle.test.ts` **12/12 通过**（含 2 个子案例），tsc 与 features/tests diff check 均通过。新增不确定响应后同步发现同 ID、修改质量重试的回归，覆盖固定创建时间、其它记录保留、自身/异 ID 重叠和回拨独立区间。已通知 root 重新 build；旧 dist 的浏览器验证不充当此次补修验收。没有启动、关闭服务或操作真实数据。

- 工作目录：`C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-health`，分支 `codex/forma-local-safety-20261016`。已读 AGENTS、TASKS 顶部 L-03、旧 features 状态和发给 features 的请求；仅修改本轮授权的 features 路径、`tests/editor-lifecycle.test.ts` 及此状态文件。没有操作原目录、真实记录、GitHub、AI、部署或现有开发服务。
- Nutrition 和 Reports 复用 `attachmentLifecycle.ts`：从未提交的上传仍在取消/替换/卸载时清理；交给 save 之前即保留附件，响应丢失或队列保存抛错后不再把它当作无引用资源删除。原上传 ID 可用于重试；新草稿创建时固定 UUID/createdAt，按现有 ID upsert，避免不确定保存后的重试重复。保守保留可能包括最终未引用文件，本轮不自动猜测或回收这类文件。
- 两页上传、食物识别、附件 DELETE 固定发起编辑器的 accountId，显式覆盖可变全局 account hint；上传返回后如组件已卸载，只清理确定尚未交给 save 的文件且仍绑定原账号。Nutrition/Reports/Sleep/Settings 的异步完成均加或保留 mounted 守卫；App 的业务子树 account+epoch key 与 save 绑定由 root 实现。
- Sleep 使用 `sleepTime.ts`：未改动的分钟输入返回记录原始 ISO，保留回拨第二次时刻与隐藏的秒/毫秒；新增或修改的重复本地时刻明确拒绝并提示重选，跳时缺口与非法日期也拒绝，不擅自猜测第几次时刻。支持纽约整小时及 Lord Howe 半小时回拨边界。
- Settings 的导出和账户 DELETE 固定 ownerAccount，卸载后不下载或通知；JSON 按服务端快照导出，因此文案说明先完成同步，未同步本机改动不包含。JSON 只有记录、附件元数据/引用，不含照片、报告图片或 PDF 本体，不能作为完整附件备份；删除账户前须另存所需文件。
- 已执行：`node --import tsx --test tests/editor-lifecycle.test.ts` **10/10 通过**（包含 2 个子案例）；`node node_modules/typescript/bin/tsc --noEmit` 通过；`git diff --check -- src/features tests/editor-lifecycle.test.ts` 通过。回归覆盖 uncertain save→cancel/unmount、重试/替换、清理失败/延迟、旧账号 upload/analyze/DELETE/export/account 边界，以及纽约/Lord Howe/UTC 的 DST/精度/非法输入。
- 尚未由 features 执行：真实浏览器离线队列、保存响应丢失后取消、跨标签/跨账户组件生命周期、完整 Vite build。以上由 root 统一使用合成账号串行验证；本轮 helper/API mock 回归不冒充真实浏览器或真实 HTTP 测试。没有提交代码。

## 正在做

T-03 完整训练五组 UI 已实现并通过 TypeScript 与双语 SSR smoke，正在交给 lead 串行构建、真实浏览器与同步验收。AI-03 已交付并由 lead 验收，历史记录保留在下文；未将真实 OpenAI 推理质量写成已验证。

## T-03 已实现

- 已读当前 AGENTS、TASKS、status、ADR-training-sync、共享类型、catalog/domain/import 和设计系统，遵守 Training.tsx / features/training/ 独占所有权。没有复制外部训练 UI、代码、schema 或图片。
- 训练页按动作库、计划、训练中、进步、导入拆分可执行组件。动作库覆盖 lead 提供的 884 个文字动作，搜索/器械/主要肌群/原创教学筛选、12 项分页、说明与教学播放入口；未知器械单列为未注明，英文来源文本明确标识。
- 计划创建/复制/编辑成追加版本、默认展示叶版本、历史版本只读；星期/循环日程可编辑、起始日期与休息槽、今天的计划可以启动。编辑与进阶生成新 UUID 并更新指向原版本的日程引用，不改变训练历史。
- 训练保存实际 nullable 组数据，目标与实际分离；工作/热身/递减、父组关系、超级组、RPE/RIR、时长和距离可填。完成必须有实际次数+明确重量（自重填 0），或实际时长；递减父组先完成，撤销父组需先撤销已完成的子组。
- 休息使用持久 deadline；暂停存剩余秒数、续计重建 deadline。同超级组本轮和递减链还有未完成组时，提示下一动作/组且不启动自动休息，全部完成后再休息。
- 结束前展示完成组、可校正总时长及明确确认 checkbox；只保存实际完成组，Workout UUID 沿用进行中会话身份以稳定重试；动作备注合并到训练备注并校验总字符上限。热身保留事实，但不进入工作组进步。旧快速汇总独立保留编辑/删除，不生成逐组事实或覆盖详细记录；RPE未知允许 null。
- 进步接 QA 原创纯函数，显示完成组、已知负重×次数/未知完整度、主要肌群、独立 PR 指标及限定范围的 e1RM；两次达标仅提供可编辑草稿，展示两次依据和前后目标，确认后追加计划新版本。
- 导入 Strong / Hevy / FitNotes CSV、Forma JSON：浏览器本地解析、来源单位/时区、阻塞错误、重复排除、逐条选择、缺时长人工补齐、逐组数值与完成状态校正；确认后只追加训练 UUID，保留导入指纹。未确认不保存。
- mounted / operation locks 防卸载后的成功 toast；训练与日程/历史草稿检测远端变化；训练离开有未保存改动时需明确放弃，保存期间禁导航。onUnsavedChange 通过稳定 ref 向 App 上报活动状态并在卸载回 false，接入 lead 主导航提醒；beforeunload 仅在 dirty 时提醒。真实同步和离线状态由 lead 的账户绑定 App/SyncEngine 负责。

## T-03 验证与边界

- `node node_modules/typescript/bin/tsc --noEmit`：通过。首次只见 qa 测试的 triceps 推导类型错误，由 qa 按所有权修复；随后完整 tsc 通过。
- `node --import tsx --input-type=module` 双语 SSR smoke：10 次渲染通过（Training 导航、Library 884 数量、Progress 缺失 —、Import 四格式、Session 用户原文/实际 null 空输入）。不把 SSR 视作浏览器、离线或教学动画验证。
- 完整 Vite build、响应式/键盘/真实保存/刷新恢复/多设备冲突由 lead 统一串行验收；features 未并发清理 dist、未启动或结束共享端口服务。
- QA 的 22 项 domain/import 纯函数测试已通过（QA 执行结果）；随后 helper 的 3 项独立边界测试通过，覆盖目标不冒充实际、超级组/drop 后休息、稳定结束身份/notes/Timed null 与实际 server workoutSchema。
- QA 随后交付新版本进阶限制与同步边界验证：新增独立 39/39、当时全仓 155/155、tsc 通过。末次 sibling drop 分支补充在既有测试内，提交 c0ce4da，独立 helper 3/3 与 tsc 再次通过；没有把这次单测冒充全仓重跑。
- 请求 1450（计时/兼容摘要）与 1600（跨页未保存）已获 lead 回复并接入；进阶新版本避免复用旧两次依据的规则已交 qa/lead 核查，不在 UI 假设领域规则。
- lead 真实 UI 已验证 884 库数量、二头肌/哑铃/教学筛选 1 项、示意播放、1+1 组超级计划、星期与循环日程、A 工作组后提示 B 且不休息、A 递减组及 B 末组后休息。计时初值发现 90 秒显示 91 秒，Session 已用 Math.max(clock, Date.now()) 修复；暂停继续读 stored seconds，待 lead 复验（1630 请求记录）。
- lead 已运行完整训练构建成功（Training chunk 约883 KB / gzip187 KB，主 chunk约396 KB / gzip124 KB、4 静态离线文件），随后最后计时修复/导航回调由 tsc 验证，最终构建由 lead 接续；不把旧构建当作后续浏览器修复的复验。
- 必要失败重试修复由 lead 明确纳入：routine 候选 id/createdAt/updatedAt 在建草稿时固定，submit 不重新生成；若 view 已有候选 ID，提示顶部同步重试或关闭后编辑新版本。日程引用更新时间独立于旧草稿时间，保持不早于已有日程时间。QuickSummary 新记录在 open 时固定 UUID/createdAt，用 existing 区分编辑，submit 按 state 是否含同 ID 替换或新增，防重复创建。
- 最后 `node node_modules/typescript/bin/tsc --noEmit` 通过；补充中英 SSR 回归 4 次渲染通过，核对旧摘要原文/RPE未知为 —、详细记录不进入旧编辑入口、计划创建入口。低影响身份/时间字段修复未写实现镜像测试；网络队列幂等由 QA 的实际 engine/API 测试覆盖，浏览器由 lead 实测。
- 未公开部署或开通付费服务；导入覆盖明确受支持的英文导出格式，未声称兼容所有应用版本或地区格式。没有设备/iPhone/HealthKit/Apple 登录实现声明。

## 已完成

- 已读 AGENTS、TASKS、ADR-AI-food-photo、共享类型/API、当前页面和设计规格；没有发给 features 的既有请求。
- 使用项目 React best practices 和 i18n-expert 的双语/错误码指导；沿用现有语言切换，不改全局 i18n 架构。
- 上一轮四模块实现已有 TypeScript/Vite 与双语渲染验证；这些不充当本轮 AI 流程已通过的证据。
- Nutrition 保留原手动/标签流程，新增照片 → 每次明确 OpenAI 同意 → 私有上传与识别 → 多食物候选校正/移除 → 用户确认保存。每项使用每 100 g 标定和确定性份量换算；null 保留空值，未知或无效值不参与完整合计、不允许确认保存。
- 保存保留 aiDraftId、原 aiItemIndex、assetId、referenceGrams=100、source=ai_estimate；候选 Meal UUID 在重试期间稳定。既有 AI 记录修改数值保留来源，明确改为手动/标签时才清 AI 关联。
- AbortController + 运行代次 + mounted guards 覆盖上传、识别、确认、取消、卸载后响应与 toast；变更照片清草稿/同意。新上传资源在取消/替换/移除或卸载时清理，失败保留可重试，成功保存清 staged 标志；从不直接删除旧记录引用的附件。
- Settings 读取 capabilities：区分配置存在、未配置、无效与读取失败；识图、OCR、Apple 登录、HealthKit 分开说明。演示不请求识别、不模拟 AI；提供创建账户入口。
- 每次同意说明仅照片副本及输出语言发送 OpenAI、不附其它记录、去 EXIF 和供应商保留政策；链接到已读取的 OpenAI 官方数据政策。没有零保留、医学判断、过敏原确定性或置信分数承诺。
- 处理 lead 的 20261014-1300 请求：审核 h3 使用 ref / tabIndex=-1；只有新的 aiDraft.id 出现且 analyzing=false、标题已渲染时触发一次 preventScroll focus 和 scrollIntoView(block=start, behavior=auto)。非食物结果同样定位到审核说明；编辑数值、删候选和同意 checkbox 不改变草稿 ID，不抢焦点。

## 验证

- node node_modules/typescript/bin/tsc --noEmit：通过（Nutrition/Settings 接入完成后再次运行）。
- 临时 node --import tsx --input-type=module SSR smoke：通过；验证中英渲染、用户食物原文保留、AI 来源标注、每 100 g 的 150 g → 300 kcal 换算、Settings OCR/Apple/HealthKit 分离及政策链接。
- git diff --check -- src/features/Nutrition.tsx src/features/Settings.tsx：通过；只有 LF/CRLF 提示，无 diff 空白错误。
- 本轮首次 npm run build：tsc 通过，Vite 清理 dist/demo-meal.png 时 EPERM；lead 确认当时并发构建，lead 的完整构建已成功。随后不再并发执行 Vite，只运行 tsc；最新完整交付等 lead 串行构建确认。
- QA 已报告独立 HTTP/API 边界 44/44、全套 npm test 55/55 通过；这些是 QA 执行结果，不是 features 自己运行的供应商实测。
- lead 最终串行 npm run build：完整通过；最新 npm test：57/57 通过。以上由 lead 执行并在协作消息确认，覆盖最终集成代码；首次并发构建的 EPERM 不再阻塞。
- lead 在 IAB 的隔离测试夹具完成真实 UI 交互：模型 null 保留空且保存禁用 → 米饭名称/150 g 改为 200 g → 鸡肉补 100 g、fat 3.6 → 425 kcal 合计 → 删除鸡肉候选 → 显式审核 checkbox → 保存单项。保存结果 260 kcal、protein 5.4 g、carbs 56 g、fat 0.6 g，来源仍 AI estimate。
- IAB 截图接口不可用，lead 改用已授权的现有 Edge 补响应式查看；features 没有把不可用截图或真实供应商照片质量写成已验证。
- 聚焦修复后 node node_modules/typescript/bin/tsc --noEmit 与 git diff --check -- src/features/Nutrition.tsx：通过（仅 LF/CRLF 提示）。遵照 lead 协调，没有并发执行 Vite；本次完整构建和滚动截图由 lead 接续验证。
- lead 报告聚焦修复前全套测试已达到 99/99（含独立 Claude rules 测试）；未把这视为新滚动行为的浏览器验证。

## 阻塞与请求

- 请求 requests/20261014-1157-features-to-lead-ai-upload-cancel.md 已获 lead 回复并完成 API/App 修改；features 已采用 signal 和 onCreate。
- 实现没有待解决契约阻塞。lead 已完成隔离测试夹具交互验收，qa 已获知最终 Settings 和源标注行为；不会停止或改动共享服务端口。
- requests/20261014-1300-lead-to-features-ai-review-focus.md 已在接收方回复中记录修复和 tsc 结果；没有接口、后端或样式改动。

## 待用户决定

- 用户已说明稍后配置 OpenAI 密钥；本轮不会启用账单或声称真实供应商推理已验证。
