# PR #2 独立审查（2026-11-04）

审查员：专项06 / qa-pr2；独立于实现者01，本轮本人执行下列检查。结论：**通过本次日期修改的独立审查，未发现需修复的范围内可复现缺陷**。允许01按既有集成流程处理；本报告不代表全产品安全、部署或真实账户验收。

## 固定对象与边界

- 验收候选：`cd508758a8b8f3d61b1decf40e23e0409b7c6b39`。
- 比较基线：`70170640b74c9067291eb2195aef17ca4a6a9fb3`。
- 独立 checkout：`/Users/shendejun/.codex/worktrees/forma-web-date-fix/运动健康网站-GitHub最新版/.forma-local/reviews/pr2`，开始时工作树干净、detached HEAD 等于候选。
- 阅读根 AGENTS、FORMA、当前 TASKS、日期 ADR、全部基线差异、types 日期 helper、Dashboard、Trends、作者日期单测及 browser 脚本。产品源码只读；仅增加本人测试和本报告。
- 不读 .env、真实 data、账户或附件，不调用 AI/收费服务，不使用默认3001/5173服务，不推送或合并。依赖与媒体使用已准备的同锁版本链接。

## 独立反例及观察

| 检查 | 本人结果 |
|---|---|
| 档案优先与回退 | 上海/洛杉矶相反配置按档案日；缺档案、空串、非法时区按浏览器日；纯函数无效浏览器最后回退UTC；有效档案不被无效浏览器覆盖 |
| 机器日期键 | 极端UTC+14/UTC-11、Kathmandu与St Johns半小时/非整点区域跨年键为ASCII Gregorian YYYY-MM-DD；不依赖UI本地化串 |
| 7/14窗口与边界 | 5时区 × 7时刻 × 2长度，共70组窗口，独立sv-SE民用日oracle及UTC午夜序列对照；包含DST跳时/重复小时、月年界、2028闰日，数量、首尾、连续性正确，输入Date未改变 |
| 单时钟快照 | 注入第一次读为年末、后续读为次年零点的Date；helper仅取一次当前时刻，14天窗口与today一致；源码确认两消费者同时取出today/dates |
| UTC+14标签 | 浏览器和档案均Kiritimati，固定2027-01-01T00:15Z；首页末列及趋势选择日期均显示周五/Fri，不误偏到周六 |
| 缺失与0 | 首页有记录且0kcal仍为0，训练/睡眠无记录为—；趋势缺记录点为—、有记录0显示0kcal；14/7切换点数与首日正确 |
| 行动键与历史 | 跨区点击训练完成写入视图日；旧2026-12-01睡眠键和2026-12-31营养键保留；保存捕获的meals/workouts/sleeps与原合成状态深度相等 |

独立新增测试为 `tests/pr2-independent-review.test.ts` 的3项，未修改或复写作者测试。独立浏览器脚本位于本checkout忽略目录 `.forma-local/review-evidence/browser-independent.mts`；使用自有跨年数据和断言，两种语言 × 六种浏览器/档案配置，共12组。测试真实 Dashboard、Trends React组件；仅CompanionCard以空组件替代，保存为合成捕获，无App/后端/身份服务。未将作者曾报告的测试数字作为本人实测。

## 本人实际执行

按日期专项、真实两页浏览器、全套、构建顺序执行；新增测试最终内容调整后再次运行专项，再运行全套。

| 命令 | 结果 | 本地证据 |
|---|---|---|
| `node --import tsx --test tests/view-dates.test.ts tests/pr2-independent-review.test.ts` | 7/7，0失败 | `.forma-local/review-evidence/date-tests.log` |
| `node --import tsx .forma-local/review-evidence/browser-independent.mts` | 12/12，中英浏览器场景无pageerror | `browser-independent.log`、`browser-independent-results.json`（同证据目录） |
| `npm test` | 478/478，0失败/跳过；含本人3项 | `.forma-local/review-evidence/npm-test.log` |
| `npm run build` | exit 0；5632动作/视频和11328媒体内容校验；tsc、主站、训练工作台、伴侣岛、训练源码包、发布标识及离线壳完成 | `.forma-local/review-evidence/build.log` |
| `git diff --check` | 通过 | 本人终端执行 |

构建存在大chunk提醒，未导致失败；不作为本日期修改的新缺陷。构建身份为固定候选完整SHA。完整测试/构建完成后已通知01释放验证时段。

## 残余边界

未运行真实账户登录、数据库写入、真实健康数据、设备接入、收费服务、移动设备或所有浏览器；保存仅验证组件提交状态，不代表服务端全流程。长驻页面跨午夜自动刷新按ADR明确不在此次范围。非日期聚合算法、其他页面记录日期语义均没有因本次通过而获得新的全面验收。提交仅含报告/独立测试，01应保持候选与证据变更的区分。
