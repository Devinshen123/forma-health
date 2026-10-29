# 01独立固定源核对与设计约束

任务：FORMA-REPORT-CLOSE-DESIGN-20261029。01 lead / Codex，2026-10-29；现有隔离checkout / codex/fud-food-photo-20261022，开工42677f42干净。固定源码7b260c2；本轮只核规格需要的接口和状态分支，不重复上轮F1/C1审查。

**阶段：01的前置静态核对已完成，原02新规格尚未投递/返回。** 下列为01实际读取的证据和评审要求，不是02作者方案，不是06或产品通过。

## 已核接口与不可破坏条件

| 固定源位置 | 实际已观察事实 | 规格约束/待明确点 |
|---|---|---|
| types.ts:248–256；App:293 | save(next)为Promise<void>；notify双语；onUnsavedChange可选，参数dirty/busy；App回调受epoch约束 | 复用接口，无新增返回状态/API字段；Reports接收并桥接，不能把回调写到其他账户 |
| useRecordGuard.ts:5–15 | effect发布dirty/busy；卸载false/false；dirty或busy才绑定beforeunload并移除 | 不另起常驻监听或持久化健康草稿；同帧用户动作须由事件入口自身防并发，不能假定effect已同步发布 |
| Reports:185–208；:222–265 | open生成随机marker key、新草稿id；从demoFiles取file；选文件可自动填name；移除附件可清assetId | 基线在一次open构造完成后记同一draft/file；比较当前字段、assetId和File身份，改回原值的语义要明确；不可只JSON序列化File |
| Reports:267–305；Sleep:50–62,88–107 | 验证失败可能不进busy；Sleep用attempted或snapshot差异判断dirty | 报告未改但提交失败时是否继续保护，须由02明确作技术选择；dirty不等同state.reports有变化 |
| Modal.tsx:25–35,43–53,61–65 | Esc/cancel、X、遮罩走onClose，遮罩需target/坐标判断；closeDisabled已存在 | 四入口归一；busy拒绝/禁用，确认层自己的Esc/X/遮罩为Keep；背景侧栏force-click不合法 |
| RecordDiscardDialog.tsx:4–11 | onClose=onKeep；按钮没有busy参数；文案说明不撤销已保存/待同步记录 | 规格要决定确认放弃后先撤确认层还是保持，以及清理失败后的焦点/错误/再试；不暗自给通用组件加接口 |
| Reports:149–184 | discard成功且mounted才清uploadedId；失败保留并报错；close设busy，清draft/file在discard成功之后 | 不先清草稿/dirty/附件引用再await；失败保留可恢复状态。重复关闭不能并行发DELETE |
| Reports:306–340；attachmentLifecycle.ts:13–24 | 上传后stage，save前retainForSave；discard不删submitted id，删除失败不清currentId | 关闭放弃仅处理尚未提交的附件；已提交即使save reject也可能在队列/服务端，不删、不称撤销 |
| App:178–214；sync/engine.ts:56–74 | App save校验epoch；SyncEngine先persist排队再flush；enabled下部分网络错误可返回成功，pending仍可非零 | “save已完成”与“远端已同步”不同；无接口返回同步结论，文案不得承诺同步完成；保存未确认时沿现有同步状态处理 |
| Reports:308–315,333–374 | 上传/保存等待期busy；未mounted不回写UI；保存失败保留输入，文案“保存暂未确认” | 只在自身成功路径清基线；失败仍dirty、可重试/可确认关闭，不删submitted附件；不能无限自动重试 |
| App:285–293,494 | 导航先busy拒绝，再dirty确认；强制离开清unsaved；已有App离开框独立于Reports框 | 表单打开时背景不可点；App桥接先按回调/状态层验证，完整App用户操作只测可达入口；不制造双重确认死锁 |
| App:239–262,396；Reports:125–142 | 账户epoch变动重建特性组件；ownerAccount固定；卸载discard失败被catch忽略 | 会话安全失效优先；不能用dirty提示把A输入留给B。可能孤儿与跨账户可读分开举证，不为清理旧附件恢复旧身份 |

以上均来自普通有界git show/rg，不来自运行。开工还核对7b260c2→42677f42的src/server/tests/ios差异为空；Git worktree登记原C仍main/ba4822b，未写原C。

## 02方案必须消除的六个实现歧义

1. draft/file/attempted/error/submitted组成的最小状态集合，以及相同文件元数据不同内容、demo现有file、修改后恢复的dirty定义。
2. 同帧Esc/取消/双击、上传/删除/关闭时的单飞策略；React busy与useRecordGuard effect都不是同步锁。
3. 放弃确认层什么时候退出，底层cleanup失败时保留哪些引用/基线、焦点与重试；确认层没有新增busy接口可默认依赖。
4. 上传失败与save未确认的区分；保存已排队/accepted但返回异常时不删附件、不重复提交事实、不显示“已同步”。
5. N8清理失败的可达性和测试层级：当前上传后到retainForSave之间无正常用户await间隙；活跃编辑器里的unsubmitted stage故障如果只能受控组件注入，须明说。已提交附件“不发DELETE”是另一条真实不变量，不得与清理失败混成同一用例。
6. 每个N1–N13的observable oracle/失败分级；UI伪HTTP只证界面，服务端401/404/owner证据必须在后续获准真实中间件合成环境验证。现在不创建/执行测试，也不因受限换环境运行。

## 已读技能与采用边界

- REA v39完整入口：`D:/AI-tools/skills/_codex/reverse-engineer-anything/SKILL.md`。完整源码仓库使用普通工具；没有REA readiness/provider/逆向/运行采集，没有Evidence ID。
- `.agents/skills/vercel-react-best-practices/SKILL.md`及event-handler/event-listener两条：采用关闭/保存副作用留在明确事件入口、监听有清理的原则；不引入SWR、Next、RSC或全局监听架构。
- `.agents/skills/i18n-expert/SKILL.md`：只用于现有zh/en文案一致与错误/无障碍核对；不安装框架、不运行JSON语言审计，内联双语不能拿JSON检查声称覆盖完整。
- brainstorming入口及builder-check提示已阅读；本任务已有明确范围、固定技术栈和指定原02设计/01独立核对，按该明确分工处理普通技术选择，不另开匿名代理或实施产品。产品实现仍不在本轮。
- security-review入口复用上传/账户/错误边界原则，不引入其中示例平台、依赖或原始健康错误日志。

## 当前阶段、真实检查与待交付

已实际只读核对角色/current、本人PROFILE/MEMORY/HANDOFF/status、TASKS/TEAM-ROSTER、02公开状态及范围/岗位请求、相关本地技能与上述固定源行。原02最近实际回执仍为上轮42677f42包，不自动当本轮方案。Mac实际身份/连接未知，不代选。

本轮桌面仅控制状态和既有Claude窗口只读观察，见Showroom03运行，未切换/输入；协调方先要求等待时隙，后明确转告Showroom02观察到登录阻塞和另一聊天未发送草稿，取消等待时隙。01未继续操作桌面/登录/替换入口。**原02新方案与01对该方案的最终独立评审仍待完成；当前原02后续用户决定未能读取，仍未知。** 文件落盘不代表已送达；不把前置源核对称作新规格通过。

01在允许的本地范围形成了[自拟候选规格](interaction-spec-candidate.md)和[验收oracle](acceptance-oracles.md)。静态自检已纠正单飞锁重复获取的自锁歧义，以及现有Modal首焦点可能为X而不是Keep按钮的无必要接口扩展；这些是01自检修订，不冒充原02意见。接口层判断为可沿既有签名实施，运行事实未知，原02完善/独立方案仍缺。

当前无业务/测试/API/依赖变更、网站/浏览器/server/测试/build/CI、真实数据/env/凭据、Mac/Apple/提供商、fetch/push/合并/部署/权限操作。后续先解除实际登录阻塞，再按获准协调交接一次原02，收到真实方案及版本后逐项记录通过/修订/未知；不重复上轮审查。

01实际文档核对：git diff --check exit0；本任务23个相对链接均存在，N1–N13索引完整（N8含a/b），仅结构检查未运行场景。旧report hash-object仍73fbd3d4eb5726f0c85bb7afda8884c0148d860d；相对42677f42的src/server/tests/ios/package/工作流差异为空。只精确提交本任务4份lead文档、TASKS及本人status/HANDOFF，未推送。
