# 01固定源核对与候选约束（自检）

任务FORMA-REPORT-CLOSE-DESIGN-20261029延续为FORMA-REPORT-CLOSE-CONSISTENCY-20261030。01 lead / Codex，本地2026-10-29；同一隔离checkout/codex分支，初稿起点42677f42，本轮起点aacdf31干净。固定源码7b260c2；只核规格接口/一致性，不重做旧报告。

**阶段：01候选及本轮一致性核对已形成，原Claude02独立静态审查尚未投递/返回。** 分工改为Codex修订、Claude独审，不把本自检当独审/06/产品通过。详情见[一致性记录](consistency-review-20261030.md)。

## 已核接口与不可破坏条件

| 固定源位置 | 实际已观察事实 | 规格约束/待明确点 |
|---|---|---|
| types.ts:248–256；App:293 | save(next)为Promise<void>；notify双语；onUnsavedChange可选，参数dirty/busy；App回调受epoch约束 | 复用接口，无新增返回状态/API字段；Reports接收并桥接，不能把回调写到其他账户 |
| useRecordGuard.ts:5–15 | effect发布dirty/busy；回调可选，卸载尝试false/false；dirty或busy绑定beforeunload | 缺回调仍有本地保护；旧epoch不得清B；同帧由本地单飞锁保护，不把effect当同步锁 |
| Reports:185–208；:222–265 | open生成随机marker key、新草稿id；从demoFiles取file；选文件可自动填name；移除附件可清assetId | 基线在一次open构造完成后记同一draft/file；比较当前字段、assetId和File身份，改回原值的语义要明确；不可只JSON序列化File |
| Reports:267–305；Sleep:50–62,88–107 | 验证失败可能不进busy；Sleep用attempted或snapshot差异判断dirty | 01候选明确attempted失败继续保护；同一key完整字段改回且未attempted才clean，待Claude核对，不是待用户偏好 |
| Modal.tsx:25–35,43–53,61–65 | Esc/cancel、X、遮罩走onClose，遮罩需target/坐标判断；closeDisabled已存在 | 四入口归一；busy拒绝/禁用，确认层自己的Esc/X/遮罩为Keep；背景侧栏force-click不合法 |
| RecordDiscardDialog.tsx:4–11 | onClose=onKeep；按钮没有busy参数；文案说明不撤销已保存/待同步记录 | 规格要决定确认放弃后先撤确认层还是保持，以及清理失败后的焦点/错误/再试；不暗自给通用组件加接口 |
| Reports:149–184 | discard成功且mounted才清uploadedId；失败保留并报错；close设busy，清draft/file在discard成功之后 | 不先清草稿/dirty/附件引用再await；失败保留可恢复状态。重复关闭不能并行发DELETE |
| Reports:306–340；attachmentLifecycle.ts:13–24 | 上传后stage，save前retainForSave；discard不删submitted id，删除失败不清currentId | 关闭放弃仅处理尚未提交的附件；已提交即使save reject也可能在队列/服务端，不删、不称撤销 |
| App:178–214；sync/engine.ts:56–74 | App save校验epoch；SyncEngine先persist排队再flush；enabled下部分网络错误可返回成功，pending仍可非零 | “save已完成”与“远端已同步”不同；无接口返回同步结论，文案不得承诺同步完成；保存未确认时沿现有同步状态处理 |
| Reports:308–315,333–374 | 上传/保存等待期busy；未mounted不回写UI；保存失败保留输入，文案“保存暂未确认” | 只在自身成功路径清基线；失败仍dirty、可重试/可确认关闭，不删submitted附件；不能无限自动重试 |
| App:285–293,494 | 导航先busy拒绝，再dirty确认；强制离开清unsaved，未await Reports清理 | 四普通关闭入口统一不等于改force/安全卸载契约；App桥接按回调/状态层验，不force-click背景制造UI复现 |
| App:239–262,396；Reports:125–142 | 账户epoch变动重建特性组件；ownerAccount固定；卸载discard失败被catch忽略 | 会话安全失效优先；不能用dirty提示把A输入留给B。可能孤儿与跨账户可读分开举证，不为清理旧附件恢复旧身份 |

以上均来自普通有界git show/rg，不来自运行。初稿核对7b260c2→42677f42无产品差异及原C main/ba4822b属于前轮记录；本轮另核7b260c2→aacdf31的src/server/tests/ios无差异，不将前轮原C未提交清单当今天实测，原C保持冻结。

## Codex候选已明确、Claude待独立核对的六个要点

1. draft/file/attempted/error/submitted组成的最小状态集合，以及相同文件元数据不同内容、demo现有file、修改后恢复的dirty定义。
2. 同帧Esc/取消/双击、上传/删除/关闭时的单飞策略；React busy与useRecordGuard effect都不是同步锁。
3. 放弃确认层先撤再异步清理，失败回原编辑器保留引用/基线；确认层不增加busy接口，operationKind在Reports内区分阶段。
4. 上传失败与save未确认的区分；保存已排队/accepted但返回异常时不删附件、不重复提交事实、不显示“已同步”。
5. N8清理失败的可达性和测试层级：当前上传后到retainForSave之间无正常用户await间隙；活跃编辑器里的unsubmitted stage故障如果只能受控组件注入，须明说。已提交附件“不发DELETE”是另一条真实不变量，不得与清理失败混成同一用例。
6. 每个N1–N13的observable oracle/失败分级；UI伪HTTP只证界面，服务端401/404/owner证据必须在后续获准真实中间件合成环境验证。现在不创建/执行测试，也不因受限换环境运行。

## 已读技能与采用边界

- REA v39完整入口：`D:/AI-tools/skills/_codex/reverse-engineer-anything/SKILL.md`。完整源码仓库使用普通工具；没有REA readiness/provider/逆向/运行采集，没有Evidence ID。
- `.agents/skills/vercel-react-best-practices/SKILL.md`及event-handler/event-listener两条：采用关闭/保存副作用留在明确事件入口、监听有清理的原则；不引入SWR、Next、RSC或全局监听架构。
- `.agents/skills/i18n-expert/SKILL.md`：只用于现有zh/en文案一致与错误/无障碍核对；不安装框架、不运行JSON语言审计，内联双语不能拿JSON检查声称覆盖完整。
- brainstorming入口/builder-check提示前轮已读；本轮为既有候选的一致性修订，按新分工Codex作者/原Claude独审，不另开匿名代理、不实施产品，不把旧设计分工带入本轮。
- security-review入口复用上传/账户/错误边界原则，不引入其中示例平台、依赖或原始健康错误日志。

## 当前阶段、真实检查与待交付

已实际只读核对角色/current、本人PROFILE/MEMORY/HANDOFF/status、TASKS/TEAM-ROSTER、02公开状态及范围/岗位请求、相关本地技能与上述固定源行。原02最近实际回执仍为上轮42677f42包，不自动当本轮方案。Mac实际身份/连接未知，不代选。

不以前轮窗口观察证明今天。**本轮ControlStatus元数据实际ready/generation1/wait0；先读Showroom02紧凑状态为active，之后协调方明确转交该原02在UTC10/30约06:16的新观察：Claude仍需重新登录，当前另一聊天草稿，未发送且已释放时隙。** 此为转交来源，不是01截图或原Forma02接单。01本轮未操作窗口；原Forma02任务/后续用户决定未从原入口核对，没有投递/ACK/独立审查，不把ready或落盘当已审，也不为同一登录缺口反复操作。

01继续修订[候选规格](interaction-spec-candidate.md)与[oracle](acceptance-oracles.md)，纠正旧作者分工、补operationKind/可选回调/epoch、明确同key恢复、N4同步层控制组及N8分支。原单飞自锁/首焦点修订保留，均为01自检，不冒充Claude意见。接口签名可复用，运行表现和本轮独审未知。

无业务/测试/API/依赖变更，未执行应用/浏览器/server/测试/build/CI、真实数据/env/凭据、Mac/Apple/提供商、fetch/push/合并/部署/权限。只有协调时隙、原入口身份和访问许可都重新核实后才投一次本包；不可访问则精确保留未接单并终态报告，不无限等登录或借CLI/API绕过。

前轮23链接/结构检查是aacdf31历史结果。本轮实际核对、待审4文档blob、未运行层与本地提交范围在[一致性记录](consistency-review-20261030.md)单独列出；不以旧通过数作本轮验证。旧报告73fbd3d4及关闭回执39775f5e与固定提交均一致，保持不动。
