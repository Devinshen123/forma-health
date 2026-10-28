# FORMA-REPORT-NAV-STATIC-20261028：报告页导航静态诊断

执行者：01 / lead，工具Codex；具体运行模型未核实。日期：2026-10-27，America/Los_Angeles；任务ID沿用协调消息的UTC日期。审查对象是网站“报告 / Health reports”，不是趋势统计或iOS训练工作台。

**结果：发现一项未保存输入保护接线缺口。报告编辑器没有调用已有useRecordGuard，也没有向App报告dirty/busy；已有组件测试不挂载完整App，不能关闭主导航验收缺口。** 本文是固定源码诊断及最小修复/验收设计，没有运行、修复或部署产品。独立Claude复核仍未接收，不能称02或06通过。

## 1. 固定对象、写者和边界

- 源码SHA：`7b260c2a21acfd2009a753e3b07385e5fe7320a5`。
- checkout：`C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`；分支`codex/fud-food-photo-20261022`，开工干净。01是本报告及本人任务记录唯一写者。本轮不fetch、不合并、不push、不另建worktree/代理或第二个lead。
- 原`C:/Users/devin/健康网站`保持不动，仅有界读取公开协作记录；其main仍为ba4822b。Mac、真实健康记录、环境文件和凭据均未访问。
- 原02公开status/dispatch最新可见工作为2026-10-24；历史Claude会话ID不是当前连接证明。Codex会话元数据只确认01活跃，不能证明Claude忙闲。未发现已核实可用于原02的非UI通信入口；共享桌面时隙尚未由协调方交回，因此没有切窗口、键鼠输入或通过新CLI恢复旧会话。
- 新读取的工作区AGENTS自述撤销旧项目规则；本轮仍服从直接用户“原目录不动”和本次明确静态限定，文件文字不能放宽这些限制。已读取FORMA、TASKS、角色/current、本人记忆、02公开状态及原AUTH-DIAG-02候选。
- 已读security-review技能，使用其鉴权/附件隔离/错误边界检查；未执行其中测试、安装、audit或部署步骤。frontend-testing-debugging入口也已阅读，但其渲染验证流程不适用于本轮静态限定，未使用浏览器或Playwright。

| 源文件 | Git blob（固定SHA内） |
|---|---|
| `src/App.tsx` | `3a5fe2ebfcf832c9dc4c62a7a5202041c3cff827` |
| `src/features/Reports.tsx` | `221690138781620a59aaf418ee228145c4bfd8d4` |
| `src/features/useRecordGuard.ts` | `e8510344885212b576930efcb5bbd30bbcc821e7` |

后续行号均属于该SHA。此前“另一分支报告导航未验”的分支身份仍未知；本轮明确选择当前主管候选，不宣称覆盖未知分支。

## 2. 实际入口与调用链

| 阶段 | 源码位置 | 静态事实 |
|---|---|---|
| 桌面入口 | `src/App.tsx:38–51,303–319` | navigation含reports，侧栏全部渲染；按钮调用navigate，不是URL链接 |
| 手机入口 | `src/App.tsx:340–347,466–476`；`src/styles.css:1352–1359` | 底部只取前5项，不含第6项reports；报告通过“更多导航”打开侧栏进入。不能据底部没有报告判定不可达 |
| 页面转换与返回 | `src/App.tsx:285–293,419–439,494` | navigate检查App的unsaved，随后setPage、关闭menu、滚动到顶；reports分支渲染Reports；“回到今日”走同一navigate |
| 页面前置门槛 | `src/App.tsx:78–83,121–159,294–300,396–409` | 启动loading；getMe后取getSync并设state；未完成profile时优先Onboarding。报告不是一个独立按路由加载数据的页面 |
| 快照与账户 | `src/api.ts:74–102,136`；`server/app.ts:212–237,267–269,355` | /auth/me返回用户或null；/sync需有效会话和匹配账户hint。身份在服务端由cookie会话推导 |
| 页面内容 | `src/features/Reports.tsx:143–148,414–456,589–603` | 从state.reports筛日期、排序；有记录显示列表，无匹配显示空状态；OCR明确未接入 |
| 新增、编辑与保存 | `Reports.tsx:185–210,267–270,306–369` | draft/file在组件内存；提交可先上传附件，再调用父save；成功关闭，失败保留错误；不能把点击保存当服务端已确认 |
| 原始附件 | `Reports.tsx:566–575`；`src/api.ts:173`；`server/app.ts:407–419` | 新标签打开/api/assets/id；读取不要求自定义header，但仍验证会话并按owner查asset；无会话401、他人/缺失附件404；PDF下载、图片inline，有sandbox CSP |
| 页面刷新/浏览器返回 | `src/App.tsx:62–78,105–115,285–291` | page仅初始化为today；hash监听用于认证入口，没有报告路由push/popstate。刷新重新启动后回到today，不能保证浏览器Back返回上一功能页 |
| 退出与换账户 | `src/App.tsx:216–255,256–262,396` | 新账户/退出更新epoch、重设today并更换feature Fragment key；旧会话编辑器卸载。正常退出前有pending同步检查；dirty修复不得阻止强制会话失效清理 |

成功路径：已确认账户且已完成引导 → 主导航reports → 全局已加载的报告列表 → 日期筛选/打开附件 → “回到今日” → 重新进入报告。匿名默认演示路径可查看明确标注的演示数据，不等于拥有真实报告权限。

加载/错误路径：App启动loading是全局状态；网络故障仅在满足已启用账户离线缓存条件时走离线恢复（App:143–149），否则提示账户服务不可用并显示演示。Reports没有自己的报告列表fetch/loading/error分支，不应在未来验收中等待一个不存在的“报告API spinner”。上传/保存错误在Reports:358–369，取消清理错误在:149–169；附件新标签的401/404属于独立HTTP结果，不等于主页面自动弹出登录框。

## 3. 发现与证据边界

### F1 / P1：未保存报告编辑缺少离站及关闭确认保护

**静态确认的缺口**：Reports导入和props（:1–20、101–108）没有useRecordGuard/onUnsavedChange，完整文件有界搜索也没有beforeunload或等价绑定；draft/file/busy仅为本地state（:110–125）。App的unsaved只由FeatureProps回调更新（App:293），App唯一通用beforeunload保护仅在某个同步引擎`pending && !enabled`时触发（App:177）。因此在同步队列为空、仅报告表单未保存的场景，报告输入不会使这两层保护生效。

另一个可达关闭路径是：修改报告名称（Reports:655–663）→ 按Esc或点X/取消 → Modal的cancel/X调用onClose（`src/components/Modal.tsx:25–35,61–65`）→ Reports.close在非busy且附件清理成功时清空draft/file（Reports:171–182）。Reports把onClose/取消直接绑定close（:622–629），没有类似Sleep.requestClose（`src/features/Sleep.tsx:98–107`）的dirty确认层。

**用户影响推断**：上述条件下，刷新、离开当前文档或关闭编辑器可能直接失去尚未提交的输入。源码已证明保护没有接上及关闭函数会清空状态；本轮没有实际浏览器复现，不声称观察到提示缺失、数据丢失或某个浏览器的对话框表现。已保存报告和同步队列不等于当前未保存的表单输入，不能以同步层保护替代此缺口。

**避免伪复现**：Modal使用`dialog.showModal()`（Modal:27），背景侧栏通常不可操作。本轮不把“编辑弹窗打开时直接点背景报告/今日按钮”当作可达用户路径，也不设计force-click背景元素来伪造通过或失败。App回调未接属于代码契约缺口，真实用户复现应优先使用刷新、Esc、X、取消及关闭后正常导航。

### C1：现有测试不能证明完整报告导航通过

`tests/browser/sleep-report-lifecycle.mts:26–63`只挂载Sleep/Reports和SyncEngine，自身第50行明确“full App is not mounted”；第60行没有传onUnsavedChange。它覆盖组件/同步生命周期，不能验证App的入口、手机菜单、返回、账户切换及全局dirty桥接。`tests/editor-lifecycle.test.ts`的记录/附件状态测试也不是完整导航证明。本轮只读取测试源码，没有运行或引用历史通过数作为本次结果。

### 已有边界、产品预期和未知项

- 已见有效会话、账户hint和附件owner查询路径；本轮选定范围未发现确定的鉴权绕过，但未做完整安全审计或实测跨账户请求。
- 刷新回today、浏览器Back不管理功能页是当前代码行为；没有查到本任务要求刷新必须保留reports的明确规格，故作为预期待确认项，不自动定性为第二个缺陷或启动路由重构。
- 移动端侧栏入口及弹窗焦点、触摸布局、浏览器原生离站提示仍需真实渲染证据。
- iOS原生Tab只有today/nutrition/training/sleep/trends（`ios/Forma/App/FormaApp.swift:36–43`），WK入口只接受训练工作台home/library/stats（`WorkbenchSession.swift:148–153`）。本候选没有健康报告的原生/WebView入口，不能用训练WK测试代替报告导航验收；本轮不重复10/26草稿9场景审计。

## 4. 最小修复设计（未实施）

未来由已有前端owner在明确获准后仅修改Reports，复用已有`useRecordGuard`和`RecordDiscardDialog`，不引入新路由库、不改API或同步契约：

1. 接收FeatureProps.onUnsavedChange；open时在生成marker keys后保存初始draft和file基线。dirty覆盖字段/指标变动、附件新增/移除，以及失败提交后的未完成输入；参考Nutrition:128–129与Sleep:50–62，不因打开一个未改的报告就无条件提示。
2. 调用`useRecordGuard(dirty, busy, onUnsavedChange)`，同步App状态及beforeunload，卸载时清理回调；不把表单健康内容写localStorage。
3. 将onClose/X/Esc/取消统一走requestClose：busy时阻止；dirty时显示既有放弃确认；继续编辑保持值，明确放弃后才调用原close。保留AttachmentLifecycle的清理失败重试、pending附件归属及保存不确定状态，不能为了关闭弹窗吞掉失败。
4. 保存成功才重置dirty基线；失败时保留输入。账户epoch失效/退出安全清理仍优先，不能弹出dirty确认把账户A私有编辑器留给B。Modal可用已有closeDisabled={busy}表达状态，避免引入通用组件改造。

独立审核须检查“dirty对比是否误判”“清理失败是否丢失输入”“不确定保存是否错误清理引用附件”，不能只确认新增了hook名字。

## 5. 未来可执行验收矩阵（全部未运行）

前提：执行限制另行明确解除、现有writer核实、固定修复候选、隔离合成账号A/B及合成报告，无真实记录、env或凭据。完整App必须真实挂载，不能把现有组件harness改个名称作替代。桌面1280与手机390宽、中英入口分别核对。

| ID | 操作与前提 | 预期/应保存证据 |
|---|---|---|
| N1 | A已完成引导；桌面Main navigation→Reports | Health reports标题、选中导航、报告只来自A；截图/当前页面状态/合成快照 |
| N2 | 390宽：More navigation→Reports→Back to Today→重新进入 | 菜单可达且关闭，返回后再进正确；不要求底部存在第6项；截图/无横溢出 |
| N3 | A没有报告；或筛选无匹配日期 | 正确空状态、可新增；清日期可恢复原列表；不把缺失值变成0 |
| N4 | 打开报告、修改Report name但不保存；触发真实reload/离站并选择留在页面 | 修复前捕获实际失败，修复后表单离站保护生效且输入保留；需要用户手势后的真实beforeunload证据，不仅派发合成事件 |
| N5 | 同一dirty表单分别Esc/X/Cancel→Keep editing，再Explicit discard | 继续编辑保留值；明确放弃才关闭；未写正式报告；对话框和快照前后证据 |
| N6 | 未改表单正常关闭，再Back to Today/侧栏切页 | 不弹无意义放弃提示；导航无死锁；不能强点原生dialog背景按钮 |
| N7 | 延迟附件上传/保存；尝试Esc/X/真实reload；再注入失败 | busy保护生效；失败保留字段和可重试状态；只记录状态/数量，不记录健康内容 |
| N8 | 取消的附件清理失败，或保存返回不确定且同步pending | 不误删引用附件、不将未确认结果说成已保存；清理可重试；快照/附件存在性/同步状态证据 |
| N9 | 保存成功→关闭→今日→报告；再刷新 | 保存记录仍存在；当前刷新回today符合已记录行为，手动重进可见；若要求刷新留原页须先补产品规格 |
| N10 | 报告页新标签打开附件；无会话、A读B附件、已删附件 | A自己成功；无会话401、他人/不存在404；不展示B内容；合成HTTP状态和无敏感正文证据 |
| N11 | A编辑中，另一标签导致会话/账户变更；随后B登录再进报告 | A编辑器失效卸载，B无A输入/附件；晚到上传/保存不能写B；记录epoch与合成资源数量 |
| N12 | 启动服务失败/允许离线缓存/401三种前提 | 分清全局加载、离线恢复、演示提示和鉴权错误；不能把演示报告当真实成功 |
| N13 | 浏览器Back/Forward与刷新、认证hash回调 | 记录当前非URL路由行为；认证hash不被拟议dirty修复误当reports路由；预期变更先确认 |

验收分两层：先用回调spy/事件检查dirty、busy、卸载false与关闭分支；再用完整App执行N1–N13，记录固定候选SHA、场景、预期/实际、failed/skipped、截图/trace及合成HTTP状态。N4/N5应先在本基线获得真实失败，再在修复候选通过，不能只测实现镜像。

后续获准可运行已有低层回归：`node --import tsx --test tests/editor-lifecycle.test.ts server/api.test.ts`。已有组件harness命令需设置独立`FORMA_TEST_OUTPUT`并会启动server/浏览器：`node --import tsx tests/browser/sleep-report-lifecycle.mts`，**本轮禁止执行，且通过也不关闭C1**。新的完整App导航验收脚本当前不存在，需后续授权编写并按上述矩阵验证；不把拟议路径或未来结果当现成可运行产物。

## 6. 独立复核及交付状态

01静态部分已完成；[复核材料](claude-review-request.md)已落盘在lead专属目录。拟审核人是原02本人（Claude Code），不是06；实际审核人、工具、模型、独立checkout、接收时间、结论均未核实。没有写其review文件、启动CLI/新代理、发跨会话消息或操作共享桌面。原02若忙，只能在已允许的通信渠道排队，不能中断。

接收前置：协调方提供已释放的共享发送时隙或原02已核实且允许的非UI通道；审核方使用不在冻结原C内的已确认可写checkout，独占其review文件。仅01收到派工或材料已落盘都不构成Claude收到。若这些条件未满足，独立复核保持blocked，不能由01自检替代。

实际检查仅为Git状态/SHA/blob、源码/测试/公开协作文件有界读取、相关技能读取及文档检查。首次猜测的iOS ContentView路径不存在、PowerShell的tests/*.test.ts字面通配搜索失败，均已通过rg --files及目录-g搜索纠正，未当作缺陷证据。没有运行网站、浏览器、server、测试/build/CI、远端查询、安装、推送、合并或发布，未触碰原目录文件/真实数据。文档空白和链接检查结果记本人status/HANDOFF；产品未修，独立复核与运行时验收仍未完成。
