# FORMA-REPORT-CLOSE-DESIGN-20261029：发给原02的规格任务包

编写者：既有01 lead / Codex，2026-10-29。本文件是01的待投递任务材料，**不是02已收到、已设计或已通过的证明**。唯一任务状态仍在[TASKS](../../../TASKS.md)。

## 固定对象与现状

- 01沿用`C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站`，分支`codex/fud-food-photo-20261022`，准备起点`42677f42b6728016a59a1b73b4a0285818bde634`干净；不另建lead或checkout。
- 固定产品源码：`7b260c2a21acfd2009a753e3b07385e5fe7320a5`。上轮报告：提交`1ced52006ca6b30cf6dfea42518d41fdf6fe1f6e`、report blob`73fbd3d4eb5726f0c85bb7afda8884c0148d860d`；[关闭复核回执](../report-nav-static-20261028/closure-review-receipt.md)随42677f42交付。上轮静态审查已完成，不重复重审。
- 本轮据已确认的Reports dirty/busy接线缺口完善实施规格。只设计，不改产品、不运行产品或测试。
- 原Windows `C:/Users/devin/健康网站`整个目录冻结，包含02的review/status/requests/memory；Mac身份、会员、机器或路径不代选。
- 本轮最初只读检查ControlStatus为ready/generation1，Claude201514在Showroom03运行，01尚未切换/输入。协调方先要求等待时隙，后转告Showroom02观察到共享Claude需重新登录且另一聊天有未发送草稿，**取消等待发送时隙并禁止登录/切换/输入/换入口**。01遵守并停止桌面；原02本轮未收到。后续仅在该真实阻塞解除并获协调后交接，旧时隙不能沿用。

## 原02的任务与输出归属

请既有02 claude-lead本人在原会话`local_ccd8b410-dccb-411d-920f-ee3ad36f438f`完成方案，不新建员工/Claude CLI/会话/checkout。先回真实身份、工具/模型、实际读取的源码和文档版本，确认没有新的冲突任务或用户决定；若原会话已处理同任务，沿用而不重复。

**本轮默认只在原会话回复方案，不写任何文件。** 这样即使你的cwd仍是冻结原C，也不要求你在那里落盘。01会在自己的lead目录归属记录你的原方案和版本，独立核对后形成实施规格，不冒写02或06的作者文件、记忆或结论。

请只完善以下最小范围，并把实现事实、你的设计选择、未知/未来验收分开：

1. **状态与关闭表**：clean/dirty、busy、discard确认、附件清理中/失败、保存未确认、账户失效。Esc/X/取消/遮罩统一requestClose；继续编辑、确认放弃、干净关闭、重复点击/同帧操作分别如何处理。原生dialog背景按钮不可点；不能用force-click背景制造复现。
2. **dirty/busy桥接**：复用FeatureProps.onUnsavedChange、useRecordGuard和既有RecordDiscardDialog。明确snapshot何时生成、随机marker key与demoFiles基线、文件新增/替换/移除、修改后恢复、失败提交的规则；避免JSON.stringify(File)把文件都当成空对象。busy覆盖上传/选择附件清理/放弃清理/保存及已有同组件操作；卸载回调清false。必要的同步单飞锁与React异步state之间关系要写清，不引入依赖或通用架构重构。
3. **保存与附件**：保留RecordDraft变更冲突和AttachmentLifecycle.retainForSave。已提交附件不得随取消清理；上传前失败、上传后但save未确认、save已落队列但远端失败分别如何保持输入/错误/重试。close不能撤销已提交保存。清理失败保持哪些字段和引用，何时才允许重置基线/关闭？组件卸载清理失败只记为A可能孤儿，不展示给B。
4. **双语与无障碍**：优先复用现有文案，给中英对照、按钮/错误/忙碌状态、确认框Esc/X/遮罩等价Keep的规则、焦点返回和读屏状态。当前lang为zh/en内联条件，不安装i18n库、不增加语言。新错误不暴露健康内容或原始异常串。
5. **N1–N13验收oracle**：沿用[上轮矩阵](../report-nav-static-20261028/report.md#5-未来可执行验收矩阵全部未运行)，每行给前置、可达动作、明确预期、可观察证据、失败如何分类和停止/重试。区分纯状态/组件故障注入、完整App界面与真实服务端账户隔离三种证据；浏览器伪造401/404不能证明服务端安全。未提交附件清理失败的活跃表单路径若当前不可达，明确标受控底层故障注入，不伪称自然UI复现。N4原生离站提示需要真实用户手势/浏览器能力，不能拿合成事件替代。
6. **实施边界**：未来候选原则只动Reports及必要的对应测试；现有Modal/hook/FeatureProps/保存协议不重构，若发现确实不能满足则记录精确依赖请求而不改契约。不新增报告路由或恢复持久化，不改变刷新回today，不启动新功能/原生迁移。04/06未来实施/实测都须另有明确任务及固定候选，当前不启动他们。

01已有[固定源接口核对](source-contract-check.md)，它只是01自己的证据与待设计问题，不是你的方案或已通过的产品验收。请指出其中约束有无错误，允许在现有实现范围内作明确的普通技术选择，不需要休息中的用户来回答刷新偏好。

等待外部交接期间，01另完成了[候选规格](interaction-spec-candidate.md)和[N1–N13 oracle](acceptance-oracles.md)，均明确标01作者、待原02完善；不是Claude创意、接收或独立复核通过。实际原02的新任务/后续用户决定因登录阻塞未能读取，仍属未知，不能用历史2026-10-27回执代替。

## 开工阅读与技能适配

按真实角色读取FORMA、唯一TASKS、02 MD/current/必要记忆/请求，遵守原目录冻结。必要时读取原C现有`.agents/skills/vercel-react-best-practices`和`i18n-expert`，只采用Vite React/现有双语可用条目；不安装Next/SWR/i18next、不运行审计脚本。完整源码可直接读取，REA v39要求普通仓库工具；不用REA readiness/provider/runtime，不声称已逆向或已获得REA运行证据。

## 禁止执行与交付判定

不运行网站、浏览器、server、产品/测试/build/CI，不借另一环境规避；不读真实健康数据/.env/凭据，不做Apple/提供商登录、身份选择、收费、依赖、权限、新同步/fetch/push/合并/发布。可以用既有工具只读固定源码及文档，不启动新的模型CLI或代理。遇技术问题直接说明来源/证据，01负责技术答复。

规格应能让未来实现者不猜测上述关键分支；所有N1–N13仍标“未运行”。02方案真实返回+01独立静态核对完成，才称本轮规格包交付；不将01准备文件、旧02回执或旧通过数当本轮02接收/方案完成。

## 协调方转交的用户证据（原文）

```text
<transcript_evidence>
用户，2026-10-29 07:53 UTC，消息 Sentinel_2834190e1bfc81919ec64f2006c3f8fd：
“三个项目持续干活showroom持续做宣传片，需要做10个出来，让他使用生图功能让在我自己的电脑上在codex 和claude code”
</transcript_evidence>
```

该证据维持本轮已明确的静态范围，不扩大为网站/产品执行或抢占其他项目桌面的授权。
