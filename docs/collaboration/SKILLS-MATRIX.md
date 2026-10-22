# Forma Skills矩阵

2026-10-21。项目留C盘；复用D盘既有共享库，不迁移全机技能。没有改用户级C→D Junction；没有为每位员工重复下载一套。.agents与.claude的既有项目技能不覆盖。

## 真实状态定义

- 缺失：要求的技能/资源不存在。已下载：只有文件。可读取：实际能读取。已安装：工具发现入口或显式读取入口已配置；必须说明是哪一种。已验证加载：真实工具会话有读取/触发证据，本轮没有这种原生触发证据。
- 本轮采用可验证的显式读取：`node scripts/forma-skills.cjs list <角色ID>`后`node scripts/forma-skills.cjs read <技能名>`。它读取SKILL.md、逐文件核对已登记资源哈希，不执行第三方脚本、不调用模型。真正使用技能时员工还须阅读相关资源正文，文件检查不能冒充模型已经理解。
- registry.json逐文件记录SHA256/Git blob，固定本机内容快照，不能把内容hash伪称仓库commit。版本未知/许可未知明确保留，不宣称所有条目来源已认证。

| 员工 | 技能 | 来源 | 版本/commit | 真实路径 | 使用时机 | 加载方式 | 验证方式 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 00 dot | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 00 dot | find-skills | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\find-skills | 存在明确能力缺口时查来源/版本/许可，不凭下载数当质量结论；本轮不额外搜索或安装无关技能。 | scripts/forma-skills.cjs read find-skills | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 01 lead | team-composition-patterns | wshobson/agents/plugins/agent-teams/skills/team-composition-patterns；三文件Git blob与上游目录核对一致 | 1.0.2 | C:\Users\devin\健康网站\docs\collaboration\skills\vendor\team-composition-patterns | 拆分有依赖的跨岗位任务、选按需人数与边界；不是安装Agent Teams运行时，不启动全员。 | scripts/forma-skills.cjs read team-composition-patterns | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 01 lead | agent-development | 本机Desktop Skills；声明来源anthropics/claude-code/plugins/plugin-dev/skills/agent-development，但正文与当前上游blob不同 | 0.1.0（本机变体） | C:\Users\devin\Desktop\Skills\agent-development | 编写/审查员工触发场景、第二人称职责、流程/输出/质量和Claude适配；本机变体上游差异保留。 | scripts/forma-skills.cjs read agent-development | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取（已知缺失实用脚本） |
| 01 lead | improve-codebase-architecture | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\improve-codebase-architecture | 以后正式架构探索任务才执行完整流程；本次只读取要求并转录已存在四候选，不重复启动子代理。 | scripts/forma-skills.cjs read improve-codebase-architecture | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 01 lead | codebase-design | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\codebase-design | 以后定义模块外部接口、隐藏调用顺序/不变量、deletion test；本次不设计或实施新接口。 | scripts/forma-skills.cjs read codebase-design | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 01 lead | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 02 claude-lead | team-composition-patterns | wshobson/agents/plugins/agent-teams/skills/team-composition-patterns；三文件Git blob与上游目录核对一致 | 1.0.2 | C:\Users\devin\健康网站\docs\collaboration\skills\vendor\team-composition-patterns | 拆分有依赖的跨岗位任务、选按需人数与边界；不是安装Agent Teams运行时，不启动全员。 | scripts/forma-skills.cjs read team-composition-patterns | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 02 claude-lead | agent-development | 本机Desktop Skills；声明来源anthropics/claude-code/plugins/plugin-dev/skills/agent-development，但正文与当前上游blob不同 | 0.1.0（本机变体） | C:\Users\devin\Desktop\Skills\agent-development | 编写/审查员工触发场景、第二人称职责、流程/输出/质量和Claude适配；本机变体上游差异保留。 | scripts/forma-skills.cjs read agent-development | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取（已知缺失实用脚本） |
| 02 claude-lead | vercel-react-best-practices | skills-lock.json：vercel-labs/agent-skills，skills/react-best-practices/SKILL.md | 1.0.0；锁文件computedHash=6b526d013e28073246a36f99b529bc43745d30832ecfa8217b359c34f260ca6b | C:\Users\devin\健康网站\.agents\skills\vercel-react-best-practices | 前端方案、React交付与独立审查；仅采用适配Vite React的条目，不引入Next.js/RSC。 | scripts/forma-skills.cjs read vercel-react-best-practices | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 02 claude-lead | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 03 product | domain-modeling | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\domain-modeling | 产品流程和术语有歧义时用场景定义；只有真正改概念才维护词汇，不把技术状态写成产品事实。 | scripts/forma-skills.cjs read domain-modeling | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 03 product | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 04 frontend | frontend-design | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\frontend-design | 已派发页面任务的视觉/交互选择；Forma现有design-system优先，不另造品牌或字体体系。 | scripts/forma-skills.cjs read frontend-design | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 04 frontend | vercel-react-best-practices | skills-lock.json：vercel-labs/agent-skills，skills/react-best-practices/SKILL.md | 1.0.0；锁文件computedHash=6b526d013e28073246a36f99b529bc43745d30832ecfa8217b359c34f260ca6b | C:\Users\devin\健康网站\.agents\skills\vercel-react-best-practices | 前端方案、React交付与独立审查；仅采用适配Vite React的条目，不引入Next.js/RSC。 | scripts/forma-skills.cjs read vercel-react-best-practices | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 04 frontend | i18n-expert | skills-lock.json：daymade/claude-code-skills/i18n-expert | 锁文件computedHash=3d059508e0c60ae95c34b83fb8aabc19a6edeb8a778ffa8bdeeacd102fdd1179 | C:\Users\devin\健康网站\.agents\skills\i18n-expert | 中英字符串、错误、焦点标签、日期/数字格式核对；当前是内联双语，JSON审计脚本不能直接证明完整覆盖，不自动安装i18next。 | scripts/forma-skills.cjs read i18n-expert | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 04 frontend | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 05 backend | security-review | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\security-review | 会话/账户隔离/上传/服务端AI与审查；按Express/SQLite适配，不引入Supabase/支付，不自动npm audit fix。 | scripts/forma-skills.cjs read security-review | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 05 backend | tdd | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\tdd | 后端正式实现时在已确认外部接口按一条失败行为→最小实现逐步验证；使用node:test，不在配置阶段写产品测试。 | scripts/forma-skills.cjs read tdd | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 05 backend | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 06 qa | security-review | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\security-review | 会话/账户隔离/上传/服务端AI与审查；按Express/SQLite适配，不引入Supabase/支付，不自动npm audit fix。 | scripts/forma-skills.cjs read security-review | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 06 qa | vercel-react-best-practices | skills-lock.json：vercel-labs/agent-skills，skills/react-best-practices/SKILL.md | 1.0.0；锁文件computedHash=6b526d013e28073246a36f99b529bc43745d30832ecfa8217b359c34f260ca6b | C:\Users\devin\健康网站\.agents\skills\vercel-react-best-practices | 前端方案、React交付与独立审查；仅采用适配Vite React的条目，不引入Next.js/RSC。 | scripts/forma-skills.cjs read vercel-react-best-practices | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 06 qa | i18n-expert | skills-lock.json：daymade/claude-code-skills/i18n-expert | 锁文件computedHash=3d059508e0c60ae95c34b83fb8aabc19a6edeb8a778ffa8bdeeacd102fdd1179 | C:\Users\devin\健康网站\.agents\skills\i18n-expert | 中英字符串、错误、焦点标签、日期/数字格式核对；当前是内联双语，JSON审计脚本不能直接证明完整覆盖，不自动安装i18next。 | scripts/forma-skills.cjs read i18n-expert | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |
| 06 qa | handoff | 本机既有共享技能库；旧清单只有本机路径，上游仓库与commit待核验 | 未锁定commit；以本清单SHA256快照标识 | D:\AI-tools\skills\_shared\handoff | 阶段结束或换会话时形成有来源、脱敏的交接；项目持久HANDOFF优先于技能的OS临时目录默认。 | scripts/forma-skills.cjs read handoff | SHA256及资源读取；具体结果见CONFIGURATION-RESULTS | 可读取；显式入口已配置 |

## 许可证、资源与限制

- **agent-development**：未附独立许可；当前anthropics/claude-code根LICENSE.md为Anthropic商业条款，不能假定MIT；仅引用现有本机副本。登记7个资源文件。SKILL引用但本机缺失：scripts/test-agent-trigger.sh；禁止声称完整或触发验证通过。
- **team-composition-patterns**：MIT（已核对上游并附LICENSE）。登记4个资源文件。
- **find-skills**：本机未附独立LICENSE；待核验。登记1个资源文件。
- **handoff**：本机未附独立LICENSE；待核验。登记2个资源文件。
- **improve-codebase-architecture**：本机未附独立LICENSE；待核验。登记3个资源文件。
- **codebase-design**：本机未附独立LICENSE；待核验。登记4个资源文件。
- **domain-modeling**：本机未附独立LICENSE；待核验。登记4个资源文件。
- **frontend-design**：本机LICENSE.txt：Apache License 2.0；未据此宣称上游已核对。登记2个资源文件。
- **security-review**：本机未附独立LICENSE；待核验。登记2个资源文件。
- **tdd**：本机未附独立LICENSE；待核验。登记4个资源文件。
- **vercel-react-best-practices**：SKILL声明MIT；本机没有独立LICENSE，待上游复核。登记75个资源文件。
- **i18n-expert**：本机未附独立LICENSE；待上游复核。登记2个资源文件。

agent-development的Desktop与旧Temp同名版本先保留，没有用当前上游版本覆盖；本机SKILL Git blob为f4ea78d89bcee2febcce2285d9d41b3d17df3656，核对时当前上游36830932de4299c639d256b875e1163f3c8580ae；因此标为本机变体。另一个validate-agent.sh的旧example警告逻辑与当前正文不同，Windows本轮不执行其Bash脚本；项目验证器只验证生成配置结构，不谎称官方脚本已运行。

team-composition完整保留3个源文件与两份references，并另附上游LICENSE；Related Skills中的兄弟技能是可选关联，不表示本次安装了Agent Teams插件。

D盘_shared/frontend-design与D盘顶层frontend-design同名目录并存，选择_shared并记录哈希，不覆盖另一版本。现有HealthKit/SwiftUI技能不分配给活跃员工、不删除；它们不代表Web已实现iOS。

CLI实查Claude Code2.1.293，--agent/--agents/--tools支持已核对；未启动模型会话。Codex CLI不在当前PATH，Codex应用会话仍可显式读取MD；Dot文件连接未知。所有Claude原生触发与跨工具自动派工均未验证。

来源核对URL：
- https://github.com/wshobson/agents/tree/main/plugins/agent-teams/skills/team-composition-patterns
- https://github.com/wshobson/agents/blob/main/LICENSE
- https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev/skills/agent-development
- https://github.com/anthropics/claude-code/blob/main/LICENSE.md

来源/许可缺口由SKILL-PROVENANCE-01跟进；不得因技能例子变更框架、数据库、预算或安全约束。
