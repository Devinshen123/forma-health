# FORMA-REPORT-CLOSE-CONSISTENCY-20261030：原02独立静态审查包

编写者/候选写者：既有01 lead / Codex，本地2026-10-29、派工UTC10/30。原02职责改为**独立静态审查**，不沿用初稿“02设计、01评审”。本文件待投递，不是02接单/已审证明；唯一状态在[TASKS](../../../TASKS.md)，aacdf31初稿保留Git历史。

## 固定对象与现状

- 01沿用`C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`，分支`codex/fud-food-photo-20261022`；本轮起点`aacdf319e8addfaa7ed8f7dd185fd2795cf2f1e2`干净，不另建lead/checkout。实际交审须绑定本轮修订后提交及[一致性记录](consistency-review-20261030.md)中的4个blob，不能拿aacdf31当修订后内容。
- 固定产品源码：`7b260c2a21acfd2009a753e3b07385e5fe7320a5`。上轮报告：提交`1ced52006ca6b30cf6dfea42518d41fdf6fe1f6e`、report blob`73fbd3d4eb5726f0c85bb7afda8884c0148d860d`；[关闭复核回执](../report-nav-static-20261028/closure-review-receipt.md)随42677f42交付。上轮静态审查已完成，不重复重审。
- 本轮只审候选与固定源/已审文档的一致性并修订文档，不重做旧报告。未来产品实现按用户本轮希望由正式登记的Codex写者负责、Claude独立审查；当前不派产品实施，不运行应用或测试。
- 原Windows `C:/Users/devin/健康网站`整个目录冻结，包含02的review/status/requests/memory；Mac身份、会员、机器或路径不代选。
- 不用前轮登录缓存判断今天。本轮ControlStatus实际ready/generation1/wait0；随后协调方转交Showroom02在UTC10/30约06:16的新观察：Claude仍需重新登录、另一聊天有未发送草稿，未发送且时隙已释放。非01截图或原Forma02接单证据；01未操作窗口，本轮原02任务/身份未复核、未接收。入口/访问/协调重新核实后才投一次；不代登录、不动草稿、不换CLI/API，不重复查看相同缺口或无限等待。

## 原02的任务与输出归属

拟接收者为既有02 claude-lead本人。`local_ccd8b410-dccb-411d-920f-ee3ad36f438f`为此前核实身份，本轮仍须重新核对，不能凭历史ID认定连接。请回实际身份、工具/模型、实际读取的文档提交/4个blob及固定源码，确认无新冲突任务/用户决定；同范围已有独立包则复用，不新建员工/CLI/会话/checkout，不重复1ced520旧报告审核。

**只在核实过的原会话回复审查意见，不写任何文件。** 即使cwd在冻结原C，也不写review/status/memory。01在自己lead目录归属记录你的意见/版本并按自己作者身份修订，不冒写02/06作者文件。请给“静态通过 / 需修订 / 阻塞”及逐项位置、观察/推断/未知、实际检查/未执行层；历史通过不能代本次独审。

请独立核对以下最小内容是否已在01候选中准确说明；实现事实、01选择与未来oracle/未验必须分开，不代写另一方案：

1. **状态与关闭表**：clean/dirty、busy、discard确认、附件清理中/失败、保存未确认、账户失效。Esc/X/取消/遮罩统一requestClose；继续编辑、确认放弃、干净关闭、重复点击/同帧操作分别如何处理。原生dialog背景按钮不可点；不能用force-click背景制造复现。
2. **dirty/busy桥接**：复用FeatureProps.onUnsavedChange、useRecordGuard和既有RecordDiscardDialog。明确snapshot何时生成、随机marker key与demoFiles基线、文件新增/替换/移除、修改后恢复、失败提交的规则；避免JSON.stringify(File)把文件都当成空对象。busy覆盖上传/选择附件清理/放弃清理/保存及已有同组件操作；卸载回调清false。必要的同步单飞锁与React异步state之间关系要写清，不引入依赖或通用架构重构。
3. **保存与附件**：保留RecordDraft变更冲突和AttachmentLifecycle.retainForSave。已提交附件不得随取消清理；上传前失败、上传后但save未确认、save已落队列但远端失败分别如何保持输入/错误/重试。close不能撤销已提交保存。清理失败保持哪些字段和引用，何时才允许重置基线/关闭？组件卸载清理失败只记为A可能孤儿，不展示给B。
4. **双语与无障碍**：优先复用现有文案，给中英对照、按钮/错误/忙碌状态、确认框Esc/X/遮罩等价Keep的规则、焦点返回和读屏状态。当前lang为zh/en内联条件，不安装i18n库、不增加语言。新错误不暴露健康内容或原始异常串。
5. **N1–N13验收oracle**：沿用[上轮矩阵](../report-nav-static-20261028/report.md#5-未来可执行验收矩阵全部未运行)，每行给前置、可达动作、明确预期、可观察证据、失败如何分类和停止/重试。区分纯状态/组件故障注入、完整App界面与真实服务端账户隔离三种证据；浏览器伪造401/404不能证明服务端安全。未提交附件清理失败的活跃表单路径若当前不可达，明确标受控底层故障注入，不伪称自然UI复现。N4原生离站提示需要真实用户手势/浏览器能力，不能拿合成事件替代。
6. **实施边界**：未来Codex唯一源码写者及必要测试须另登记，不沿用旧04实施安排；本轮01仅文档、02独审。既有Modal/hook/FeatureProps/save不重构；清理成功才关闭只约束四普通编辑器入口，不扩大为App force/安全卸载await新契约。不改刷新回today/Back，不开原生/视频，不启动04/06。

01的[固定源核对](source-contract-check.md)和[一致性记录](consistency-review-20261030.md)是自检，不能替代你的独立结论。重点核查可选回调/旧epoch、单飞/operationKind、N4同步层控制组、N6同key与File正反例、N8a注入层及N8b B1/B2错误条件。给确切反证/遗漏，不需用户再选择刷新偏好。

待审4文档为[01候选](interaction-spec-candidate.md)、[oracle](acceptance-oracles.md)、source-contract-check及本请求。原02本轮任务/后续用户决定尚未从原入口核对，仍未知；不用10/29登录观察或10/27回执代替。

## 开工阅读与技能适配

按真实角色读取FORMA、唯一TASKS、02 MD/current/必要记忆/请求，遵守原目录冻结。必要时读取原C现有`.agents/skills/vercel-react-best-practices`和`i18n-expert`，只采用Vite React/现有双语可用条目；不安装Next/SWR/i18next、不运行审计脚本。完整源码可直接读取，REA v39要求普通仓库工具；不用REA readiness/provider/runtime，不声称已逆向或已获得REA运行证据。

## 禁止执行与交付判定

不运行网站、浏览器、server、产品/测试/build/CI，不借另一环境规避；不读真实健康数据/.env/凭据，不做Apple/提供商登录、身份选择、收费、依赖、权限、新同步/fetch/push/合并/发布。可以用既有工具只读固定源码及文档，不启动新的模型CLI或代理。遇技术问题直接说明来源/证据，01负责技术答复。

N1–N13仍全未运行。01静态核对/修订可先单独交付；只有原02实际ACK和独立结论返回才补其状态。原入口/控制许可不满足就保留未接单/未审并终态汇报，不无限等待或换工具绕访问。

## 本轮用户证据（原文）

```text
<transcript_evidence>
用户，2026-10-30 06:08 UTC，message_id Sentinel_bb16c2852a1c81919bb293031ef3b26a：需要你继续干活给claude code和codex布置任务
</transcript_evidence>
```

## 前轮用户证据（历史，原文保留）

```text
<transcript_evidence>
用户，2026-10-29 07:53 UTC，消息 Sentinel_2834190e1bfc81919ec64f2006c3f8fd：
“三个项目持续干活showroom持续做宣传片，需要做10个出来，让他使用生图功能让在我自己的电脑上在codex 和claude code”
</transcript_evidence>
```

该证据维持本轮已明确的静态范围，不扩大为网站/产品执行或抢占其他项目桌面的授权。
