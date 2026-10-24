## 2026-10-24 已验证 · AUTH会话与回调

AUTH-INTEGRATE：Apple跨站form_post不带Strict/Lax会话，回调只产一次性ticket，同源完成再校验Strict browser binding/原session；SW必须旁路/auth和/integrations保留native redirect。provider只按验签issuer/subject映射，不按邮箱合并。普通密码修改不能提升emailVerified；匿名已关联subject旧OAuth在reset两阶段需单调版本检查，ready ticket还需target-owner FK防删后重建。429全套、合成CUA验证见authentication-validation-20261024.md。sessions新增created_ms后旧三值INSERT后端不兼容，回退必须前向兼容，不能只切旧release。真实provider/邮件/iPhone快捷登录未实测。
2026-10-22｜已验证（代码/夹具，真实模型未测）｜FUD-01：Fud upstream 6fa1602的照片输出为整份/ingredients营养，必须按已知克重归一化到Forma每100g契约；食材取代整餐行，不能双计。缺克重不使用上游1g默认，未知保留null。capabilities/draft的analysisEngine标Fud实现来源，provider仍OpenAI，二者不可混称。来源：server/fud-ai-food-photo.ts、reuse-log、345项完整测试及CUA合成回执；运行代码28a9936，本机3001。密钥稍后配置，后续真实照片需重新实测。
# 01｜Codex项目主管 · MEMORY

2026-10-21｜已验证｜Git checkout-index会应用当前机器换行转换；仅在原工作目录验证不等于克隆后可用。实际暂存导出发现Claude入口解析需兼容CRLF/LF，注册哈希资源及混合行尾原报告需.gitattributes的-text以保持原字节；新增属性后对精确路径git add --renormalize才能刷新已暂存blob。来源：GITHUB-MAC-01、scripts/verify-forma-team.cjs、.gitattributes及status；Windows导出复验通过，不冒充Mac实机。

2026-10-21｜已验证（Windows本轮）｜GITHUB-MAC-01：Git索引精确暂存成功，旧Permission denied不再作为当前实测；GitHub API/CLI确认仓库当前PUBLIC，不能继续宣称私有。Mac通过实际checkout解释仓库相对路径，原C/D盘为Windows历史登记；Skills可用.forma-local/skills-paths.json本机覆盖，--portable结构检查不证明外置Skills安装。来源：本轮status、WORKSPACES、scripts/forma-skills.cjs与verify-forma-team.cjs；适用配置候选，不代表Mac已实测或06审查通过。

2026-10-21｜配置事实已核对，员工接手未验证｜本身份固定为lead，编号01。来源：TEAM-ROSTER、TASKS及ADR-team-seven-c-drive-20261021；适用本checkout配置，不代表其他会话采用。

旧身份/11人员工池与C→D迁移计划由最新决定替代；历史技术经验逐条核实后再采用，不把旧测试当本轮结果。

本轮由01按用户明确要求一次性更新配置元数据；不是员工本人接手或实测。原内容保留在下方历史，日常仅本人维护。当前职责以员工MD和TASKS为准。

---

## 保留的历史内容（涉及旧职责时已由上述来源替代）

# lead 长期记忆

2026-10-23｜已验证｜健康平台实现共享契约在src/health.ts；provider OAuth回调位于/integrations/:provider/callback，使用独立短期Lax绑定cookie，原账户session仍Strict。Google Health现行官方REST v4不是GoogleFit；Apple只读原生预览+单独上传，expectedRevision阻断断开/删除后的旧预览。来源：server/health、独立23项/全套377项及docs/architecture/health-integrations-20261023.md。适用代码与合成验证，provider凭证/审批/真实设备并未完成。

2026-10-23｜已验证｜新建HKSample的sourceRevision可为nil，不能当成从HealthStore读回的样本。生产mapper遇缺失provenance应fail closed；测试使用显式合成来源，不能用app默认来源伪造。来源：6e02aa0、Apple官方sourceRevision说明、MacCI40061328110新增4项通过。该CI全job仍因旧WK训练草稿恢复测试失败，不能用新增测试通过冒称完整绿。

Owner：lead。初始化：2026-10-20；执行者：lead（MEM-01）。下列为有来源的文档种子，没有运行本角色的新实现验收。

## 项目约束

- 状态：已核对文档；日期：2026-10-20。Forma 当前先做 Web；新账户为空、演示数据明示，未知健康值不填零。来源：根 AGENTS.md §1/§3。适用于全部任务，不表示本 checkout 的每个运行路径都已验收。
- 状态：已核对配置；日期：2026-10-20。本角色唯一 ID 为 lead；只维护自己的记忆和 TASKS 授权路径。来源：AGENTS §0/§4/§6、TASKS 顶部所有权表。旧角色名或个人工具记忆不能扩大权限。

## 本角色值得保留的经验

- 状态：历史记录，接手时待核对；日期：2026-10-20。日期归属分歧与旧建议 base 的 400/409 差异已在 AR-01 历史记录复现；这是待修复问题，不因配置员工而标记解决。
- 来源（文档证据，未在本轮重跑产品场景）：
  - `docs/collaboration/status/lead.md`
  - `docs/collaboration/decisions/ADR-project-worktrees-20261017.md`
- 适用范围：这些来源在当前根 checkout 中的记录；其他分支或未合并 worktree 可能不同。需要结论时读取实际代码和最新提交，不沿用旧测试数字或状态。

## 待本人积累

尚无本角色采用新配置后的个人经验条目。后续按共享 README 的日期/状态/证据/范围模板写入；不要从其他聊天补造历史。被替代的经验保留来源并标注过期。

## TEAM-EXP-01 员工池与验证（2026-10-20）

- 状态：已验证（配置与本机检查）；执行者lead；范围：根checkout main/e4c6a1b加本轮未提交文档。
- 项目现有11角色：lead/frontend/backend/qa/rules及dot/product/ux/research/security/release；TASKS为唯一所有权与任务来源。通常选2–4人执行，角色名单不表示常驻进程或已接手。
- 来源：TASKS的TEAM-EXP-01、agent-prompts/TEAM-ROSTER.md、decisions/ADR-team-expansion-20261020.md。
- 实测：本轮文档检查11角色/10任务/50链接exit0，npm.cmd run build exit0，git diff --check通过。限制：未做首次任务报告、未启动其他员工、未同步worktree，未运行本轮产品测试。
- Git暂存因.git/index.lock Permission denied失败；配置文件已保留，任务未完成提交。当前权限事实只适用于本会话，下一会话需重新核实，不据此绕过权限。
- 上方“尚无个人经验”仅为MEM-01初始化历史，已由本节替代；原记录保留。

## 2026-10-21｜七人配置与C盘决定

状态：本checkout配置与构建已验证；Git提交/原生触发/其他checkout接手未验证。来源：ADR-team-seven-c-drive-20261021、CONFIGURATION-RESULTS、TASKS。用户最新决定取消D盘项目迁移；共享规则改为FORMA，活跃身份为00–06。旧11人池、旧任务与D盘迁移意向已由此替代，保留历史。适用范围：main/e4c6a1b上的未提交配置；不能认为其他工具或worktree已经同步。
