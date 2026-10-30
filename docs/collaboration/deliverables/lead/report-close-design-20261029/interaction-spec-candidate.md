# 报告编辑关闭：01候选交互与接线规格

任务FORMA-REPORT-CLOSE-DESIGN-20261029的延续：FORMA-REPORT-CLOSE-CONSISTENCY-20261030（派工为UTC10/30，本地2026-10-29）。**作者及修订写者为原01 lead / Codex；原Claude02负责独立静态审查，当前未接单/未审。** 本轮只落实静态文档修订，不是产品代码实现或06验收。aacdf31初稿保留于Git历史；本轮审查见[一致性记录](consistency-review-20261030.md)。

源码固定7b260c2；上轮已审报告1ced520/blob73fbd3d4及42677f42回执不变。接口证据见[固定源核对](source-contract-check.md)，逐项验收见[oracle](acceptance-oracles.md)。只解决Reports编辑离开保护，不改变刷新回today、报告业务/同步协议、附件归属或其他页面。

## 1. 最小写入边界（未来另获准实施）

未来产品实现按本轮分工由正式登记的Codex唯一写者接手Reports.tsx，具体员工及对应测试范围须另派；不沿用初稿“04实施”的安排，也不因此修改员工表或启动执行者。当前仅01写文档，不改源码/测试。复用现有FeatureProps.onUnsavedChange/useRecordGuard/RecordDiscardDialog；Modal、hook、FeatureProps、App/save/API协议保持现状，若真实实施发现不能满足，先向01记录精确依赖，不能自行扩改。

以下是01的普通技术选择，等待原02核对，不冒称用户逐项决定：

- 草稿只在组件内存，不新增localStorage/IndexedDB草稿或路由恢复。
- 初次打开未改的新增/编辑表单为clean。按“核对并保存”后即记attempted，校验失败也受保护；因此即使随后改回初始值，attempted仍保持dirty，直至保存成功或明确放弃。这沿Sleep既有模式，避免把失败输入当成无内容。
- 同一marker/key等完整比较字段改回基线且从未尝试保存则clean；删除再重建marker会产生新key，不属于这一clean前提。重新选择File视为新附件，即使name/size/type/lastModified相同；不增加内容hash或磁盘读取。原demoFiles带入的同一File对象是打开基线，不误报dirty。
- 确认“放弃输入并关闭”时先撤掉确认层、再进入已有清理关闭流程；失败回到可见报告编辑器显示错误，不把错误藏在确认层后面。再次关闭重新要求确认。

## 2. 状态及dirty/busy传播

最小新增本地信息：open时的draft字段快照、File引用基线、attempted、discarding、同步单飞引用和可渲染的operationKind。operationKind限定idle/save/attachment-change/close-cleanup/delete，由获得锁的入口设置，busy与该阶段在同次更新中可见；只在归属该操作的finally恢复idle。它仅用于区分保存与清理等本地状态，不是新的API字段。保留既有draft/file/uploadedId/busy/error/mounted/ownerAccount/AttachmentLifecycle/RecordDraft，不另建保存引擎。

open在随机marker keys、新草稿id/日期和demo文件都确定后，用同一构造结果设置当前draft和基线；清attempted/discarding/error。draft快照涵盖所有编辑字段、marker顺序和key、assetId，不因每次render生成新key。File单独按引用比较，不用JSON.stringify(File)。

候选dirty定义：draft存在，且attempted、draft字段不同、File引用不同或本编辑器uploadedId非空任一成立。上传ID表明仍有本次操作待处理，不能误当已同步。dirty是内存输入状态，不由state.reports是否改变决定。

effectiveBusy覆盖Reports已有busy异步操作：选文件前清理、移除附件、上传/保存、放弃清理、同组件已有删除操作。将dirty/effectiveBusy传给既有useRecordGuard；它通过现有回调通知App并在dirty或busy时安装beforeunload，卸载回false/false。关闭/保存副作用留在事件处理，不用“设置状态→effect发请求”模式。

onUnsavedChange保持可选，缺省时hook仍提供本组件beforeunload保护，不能因缺回调抛错；完整App必须传入既有真实回调。旧组件卸载会尝试false/false，但App:293只接收匹配epoch的回调，不能将过期清理结果发布给B。effect发布不是同步锁；不要求修改共享hook或把旧epoch回调改成跨账户全局写入。

useRecordGuard的effect和React busy状态不能作为同帧互斥锁。所有进入异步Reports写入/附件清理的入口先用同一本地同步单飞引用拒绝重入，再设busy；finally仅在本实例仍mounted时恢复UI，锁按本次操作归属释放。不要把锁放模块全局；不影响其他账户组件。此锁是未来Reports内部接线细节，不改共享接口。

锁由最终异步执行入口获取一次；requestClose/确认分发不能先占锁再调用同样受锁的close，避免自锁。验证失败仍是同步分支，不占用异步锁或假装保存中。

## 3. 统一事件与状态转移

| 事件/状态 | 行为与副作用 | 保留/清除 |
|---|---|---|
| Esc / X / 取消 / 遮罩，clean且idle | 全走requestClose→原close清理流程 | 清理成功才关；无无意义确认 |
| 同上，dirty且idle | 仅打开一个RecordDiscardDialog | 不调用save/deleteUpload，不清字段/文件/基线 |
| 同上，busy或单飞锁占用 | 拒绝重入；报告Modal用现有closeDisabled，取消/保存禁用 | 编辑器不关、不发第二个保存/清理；不悄悄放弃输入 |
| 确认层Keep / Esc / X / 遮罩 | 等价Keep，只撤确认层 | 原输入和dirty不变，焦点回原编辑器 |
| 确认层“放弃输入并关闭” | 先撤确认层，再经单飞进入原close/discardUpload | 成功前不清draft/file/uploadedId/dirty；不调用保存或撤销已提交操作 |
| 清理成功 | 使用原close完成本地关闭 | 清本次字段/文件/错误/基线/attempted/discarding；回调最终false/false |
| 清理失败且仍mounted | 原编辑器可见，busy释放，显示双语安全错误 | 保留字段、文件、引用、基线和dirty；用户可重试关闭或继续编辑；不无限自动重试 |
| 保存验证失败 | 不上传/不调用save；attempted维持dirty，显示原验证理由 | 输入/附件不变；允许修正 |
| 保存/上传失败或未确认 | 保存错误，busy释放、attempted维持dirty | 不清基线，不把失败当已保存；按第4节保留附件和既有RecordDraft约束 |
| await save完成且本实例/账户仍有效 | 维持原成功路径关闭；不再要求放弃确认 | 清本地输入基线；只承诺既有保存语义，不承诺远端已同步 |
| 安全账户失效/epoch变动/卸载 | 既有App重建与失效清理优先，不弹确认阻碍安全退出 | A编辑器立即失效；不将A字段/迟到notify/附件写入B，不恢复A会话清理附件 |

遮罩指dialog本身收到弹窗矩形外的点击（Modal:43–53），不是背景侧栏/导航按钮。确认框复用既有RecordDiscardDialog的onClose=Keep；不要求新busy参数。报告编辑Modal保持挂载直到真正关闭，确认层位于其上；Keep或清理失败要回到编辑器可用焦点，实际焦点行为留未来渲染验收。

App现有navigate会busy拒绝、dirty弹离开框；Reports只提供回调，不增设路由或调用force navigate。报告modal在场时背景不可达，因此不强行点击背景来验App桥接。上述“清理成功才关闭”只约束Reports四种普通关闭入口，不扩大成App force导航/安全卸载必须await附件清理的共享契约；卸载仍沿原best-effort路径。安全账户变更与用户普通导航是不同事件，确认不能保留过期账户编辑器。

## 4. 附件与保存结果语义

1. 打开已有assetId不意味着新stage，不能DELETE原已保存附件；demoFiles只作当前页本地预览，沿原演示规则，不上传。
2. 未上传的File仍只在内存。选择/移除附件失败不能先清旧引用；用原discardUpload成功判定再改变当前file/assetId。
3. 上传成功后沿原rememberUpload/stage；调用save前沿原retainForSave和RecordDraft.submittedValue。**submitted id即使save拒绝，也不得被取消删除**，因为可能已持久排队/远端接受；不要把“放弃表单”实现成取消同步或撤销正式记录。
4. 上传失败在进入save之前与save未确认分开显示。保存拒绝保留原draft.id/createdAt和附件引用，不重新造报告id；重试仍走RecordDraft.canSave和现有同步约束。如果pending且存储未启用导致既有引擎拒绝，应引导用现有同步状态处理，不绕过冲突/排队规则或无限重发。这里不保证每次重试零HTTP请求，只要求不生成第二条报告事实/不删submitted附件。
5. `save(): Promise<void>`可能在离线存储启用、排队仍待同步时完成（engine:66–72）。不增加“已同步”成功文案或伪造服务端回执；远端状态继续以现有SyncPanel为准。
6. 仅未提交stage可由原discard删除。当前正常活跃UI上传完成后立即retain，未提交stage清理失败可能只能在下层受控故障场景触发；这与保存未确认后“不DELETE”必须分开验，不能谎称同一条自然UI路径。
7. 卸载时原discard失败被忽略可能留下A自己的孤儿附件，属于边界，不在本次新增后台垃圾回收。后续验收记录A资源数量和B不可访问分别证实，不为避免孤儿延迟账户隔离。

## 5. 双语文案与可访问性

沿现有zh/en内联机制，不安装库。复用行标“既有”，新增候选只在未来本范围采用；新错误不拼接未经审查的raw cause.message，不回显健康字段、文件名、token或堆栈。现有其它页面的历史错误展示不在本次扩改。

| 用途 | 中文 | English | 归属 |
|---|---|---|---|
| 确认标题 | 放弃未保存的输入？ | Discard unsaved entries? | 既有RecordDiscardDialog |
| 保留按钮 | 继续编辑 | Keep editing | 既有 |
| 放弃按钮 | 放弃输入并关闭 | Discard entries and close | 既有 |
| 确认正文 | 当前表单输入将丢失。已保存的记录和待同步的更改会保留；关闭表单不会撤销已提交的保存。 | Current form entries will be lost. Saved records and pending sync changes remain; closing this form does not undo a submitted save. | 既有，原文复用 |
| 关闭标签 | 关闭 | Close | 现有Modal已有双语aria-label，不全局改造 |
| 保存按钮 | 核对并保存 | Review and save | 既有Reports |
| 保存忙碌 | 保存中… | Saving… | 既有文字；未来按operationKind=save使用。基线当前仅按busy显示，尚未实现阶段区分 |
| 清理忙碌 | 正在清理未保存的附件… | Removing the unsaved attachment… | 候选，不把清理叫保存 |
| 附件变更忙碌 | 正在更新附件… | Updating the attachment… | 候选，attachment-change时使用 |
| 删除忙碌 | 正在删除报告… | Deleting the report… | 候选，只标已有删除操作阶段，不改变其业务流程 |
| 清理失败 | 无法清理未保存的附件。输入已保留，请重试关闭。 | Could not remove the unsaved attachment. Your entries are kept. Try closing again. | 候选安全错误 |
| 上传失败 | 附件上传失败。输入已保留，请重试保存。 | Attachment upload failed. Your entries are kept. Try saving again. | 候选，只用于确认上传阶段失败 |
| 保存未确认 | 报告保存暂未确认。输入已保留，请查看同步状态后重试。 | Report save is not confirmed. Your entries are kept. Check the sync status before retrying. | 候选，不能宣称撤销/未写入 |
| 记录冲突 | 这条记录已在另一处变化或删除，请取消并重新打开核对。 | This record changed or was deleted elsewhere. Cancel and reopen to review it. | 既有 |

初始确认焦点应在非破坏的保留编辑操作；现有Modal的X也等价Keep，不以“必须先聚焦Keep按钮”为通过条件或因此改通用组件。确认层Esc/X/遮罩不应提交表单。忙碌/错误在报告编辑器内给可见状态，读屏可获知；错误时保持用户输入与合适焦点，不用toast作为唯一失败证据。实际焦点陷阱、屏幕阅读器与390px文案溢出仍未验证。

## 6. 规格状态与交付条件

01静态一致性判断：上述接线不要求更改现有共享签名，普通技术选择已标注，没有产品实现。本轮改为原Claude02独立审查01候选；其通过/需修订/阻塞结论必须绑定实际文档提交和源码SHA，不把01自检冒充独审。上轮1ced520报告通过不覆盖本候选。

前轮登录/草稿观察不用于推断今天。本轮ControlStatus实际ready/generation1/wait0；随后协调方转交Showroom02在UTC10/30约06:16的新观察：仍需Claude重新登录、当前另一聊天有未发送草稿，未发送且已释放时隙。该信息不是01截图或原Forma02接单；01未操作窗口，原Forma02本轮任务/身份未复核、未接单/未审。保持不登录、不动草稿、不绕入口，不为相同缺口重复看窗口。交审清单见[审查包](request-for-02.md)，来源与静态结果见[一致性记录](consistency-review-20261030.md)。原C冻结及执行限制保持。
