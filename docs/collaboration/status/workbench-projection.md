# WB-projection：完成训练事实投影

更新：2026-10-18，America/Los_Angeles。Owner：qa 子任务。投影阶段仅写 `server/training-workbench-projection.ts`、同名 `.test.ts` 与本状态；后续 lead 另授予 `tests/browser/training-workbench.mts` 及独占合成浏览器时段。不提交，不读取真实 data/.env。

## 正在做什么

- 已读 AGENTS、TASKS 当前入口、security-review 技能、源只读 `workout-model.js` / `history.js` / `format.js` / `finish-workout.js` / `units.js`，以及 Forma 训练类型与服务端校验。
- 与 lead 和 WB-backend 确认契约：`projectWorkbenchWorkouts(source, userId)` 返回 `{workouts, warnings}`。只处理 `source.workouts` 完成历史；不读取 `active`、处方数字或 AI 输出作为实际值。
- 合法但超出现有 Forma 契约的源历史原样保存在工作台并返回通用原因 warning；不制造分钟、负重或次数。畸形已记录数据返回不含健康内容的通用错误。
- WB-backend 负责原子 CAS、原始状态与导出保留、投影所属链接、native 训练合并及冲突处理；本函数不访问数据库。

## 已完成与验证

- 已实现确定性的、无数据库与外部调用的事实投影，返回 `{workouts, warnings}`。调用方提供会话账户 ID；忽略源所有权字段。SHA-256 派生稳定 UUID，并采用源精确 `id ?? d|start` 旧记录键；源日期编辑把旧键提升为 id 时不会重复事实，缺失 start 与 null start 的键不会混同。
- 只取完成历史、逐组 done 与左右侧各自 done；未完成行及其处方值不进入实际记录。暖身保留，递减子组关联父组，rest-pause 已含 bursts 的总次数不重复相加。RPE/RIR 保留来源明确值，不互推。
- 实际 lb 乘精确 `0.45359237` 成 kg，明确 0 保留；有氧分钟转实际秒，不根据速度推实测距离。lead 已批准的 nullable 摘要与后端契约让计时/有氧未记录 reps/weight 继续为 null；已知 session 时长保留真实正小数分钟。
- 自定义与已删除动作保留提供名或明确 unknown 标签，并以独立 `opengym-custom:` 标识避免按名称猜目录。备注保留在训练备注，源完整文档仍由 backend 原样保存并导出。
- 合法但无法在 Forma 表达的整条完成历史保留 raw + 通用 warning：`missing_duration`、`missing_date`、`no_completed_sets`、`legacy_entry_without_sets`、`incomplete_measurements`、`unsupported_forma_limits`、`unsupported_load_semantics`。不制造一分钟/未知负重为 0，不悄悄抛弃动作。畸形实际数值、类型、重复稳定身份等抛统一 `Invalid training workbench data`，不回显记录。
- 实际 `node --import tsx --test server/training-workbench-projection.test.ts server/training-workbench.test.ts`：**24/24 通过**、0 fail/skip/cancel，exit 0，1252.7405 ms；随后完善精确旧身份提升测试并重跑 projection：**11/11 通过**，274.8094 ms。
- 实际 `npx tsc --noEmit`：exit 0；此前指定 `git diff --check`：exit 0。
- backend agent 另实跑其阶段全量 `npm test`：244/244，通过回执已收到；该阶段在最后旧身份兼容补充前，本子任务不冒称它是最后全量验证。最终完整 build / tests 由 lead 集成后验证。
- 有限只读复审 router/data/store 的会话与来源边界、CAS、raw/warnings/投影事务、native 保留与编辑 hash 冲突；未发现阻塞，不把该抽查当全面安全审计。没有启动固定服务、读真实数据或提交。

## WB 浏览器脚本与实际验证

- lead 追加唯一写入 `tests/browser/training-workbench.mts`，最终为 9 组集成场景，采用合成账户/临时数据库、可信 5173 源和系统 Edge。Browser plugin not available；沿用现有 Playwright，系统 Edge 加 `--disable-gpu`。已读 frontend-testing-debugging / playwright 技能，使用项目现有脚本，不安装依赖。
- 读取 vendor 实际 UI、`workbench/context.js` / `bootstrap.js` 契约，仅只读源文件。真实 UI 检查包括：iframe 会话与 5,632 动作/视频/人体；收藏与自定义动作创建；新计划配置自动保存并刷新；组勾选/完成保存及 Forma 汇总，投影只由“Manage in workbench”入口管理；围度和体重保存/历史；两张纯色合成私有照片的 UI 比较；JSON 备份下载并解析；同一浏览器 A/B 切换后 localStorage 与媒体 IDB 命名空间、无 A 数据被 B 采纳；390px 内外层溢出及展开。
- 原始照片比较数据允许合法 API fixture 播种；视频实际解码与计划/训练组/围度/体重实际由 UI 写入。截图一律遮罩所有图片及视频，人体 SVG 保留。证据/下载/失败 DOM 只保存在 `FORMA_TEST_OUTPUT` 指定的外部合成目录。
- 新增第 9 组会话缓存回归：真实 A 私有记录先缓存，再在服务端 cookie 为 B 时直开 A 的 history；延迟 `/me` 期间不能有任何私有文本或已登录导航闪现，放行后真实 401 Gate。退出后阻断 `/me` 同样只显示 Gate。MutationObserver 有独立非私有 DOM sentinel 正向活性检查，不能因监测器没运行而假绿。
- 同组另覆盖已打开的 A history：屏蔽全部工作台 API，另一真实同源 Forma 页在确认退出后写实际 `forma-session-change` 原生 storage 控制键，旧 tab 在 2 秒内 Gate，A 文本和导航消失，不等待服务器响应。
- lead 明确释放 5173 时段后，实际运行 `FORMA_TEST_OUTPUT=<外部证据目录>/browser-12 node --import tsx tests/browser/training-workbench.mts`：**9/9 通过、exit 0**。`pageErrors`、`consoleErrors`、`forbiddenOrigins`、`apiErrors` 均为 `[]`；三个预期认证失败单独记录。实际 `npx tsc --noEmit` 和指定 `git diff --check` 也为 exit 0。
- 最终外部证据：`C:/Users/devin/.codex/visualizations/2026/10/17/01a148dd-26a1-7812-a1fd-e10d8f096bd5/workbench-20261018/browser-12/`，原始终端日志为同级 `browser-12.log`。检查过已遮罩的桌面/手机/认证 Gate 截图；桌面 1440×1100、手机 390×844，内外层无横向溢出，iframe 固定导航可操作。脚本 finally 已关自己的浏览器/fixture/数据库，5173 无监听，时段已交回 lead。
- 所有前次原始失败日志保留（browser-2 至 browser-10）。适配只修测试：iframe 滚进父 viewport、等待共享搜索框所在路由挂载、Plan 的 Routines 子页、准确 Stepper/腰围可访问标签、API fixture 播种后真正重开 document。减少动态下先断言无视频，再真实点播放并验解码/时间，真实暂停后回到静图。browser-10 九项操作虽全过，但测试 init 在 opaque about:blank 访问 storage，以及序列化局部命名函数生成 `__name` 报错，因此保留该失败不冒称通过；修 init 精确 origin 作用域及匿名 observer 后 browser-11 全绿，再加入活性 sentinel 后 browser-12 全绿。未改产品、未使用 force/JS 点击、未屏蔽生产错误。
- 尚未全面验证：Safari/iPhone 实机、轮转/进阶每种配置、ZIP/备份导入、照片文件选择/相机采集。脚本在 results.json 明确这些剩余范围。

## 阻塞与请求

- 无新增产品决定。lead 已决定兼容投影 + 明确 warning，避免扩展全站旧数据契约或静默丢失。

## 待用户决定

- 无新增事项。
