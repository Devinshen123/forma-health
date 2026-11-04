# 员工MD与Superpowers配置更新计划

用户已在本会话批准此前七身份方案并要求执行、独立审查通过后同步GitHub。本计划对应唯一TASKS的 TEAM-SUPERPOWERS-20261103，不创建第二任务板。

目标：保留00–06身份、编号、协调关系、旧技能及本人记忆，以固定Superpowers流程补齐计划、排错、验证和独审。技术栈仍为现有Node配置工具、Markdown、JSON；不改业务代码或依赖。

已批准设计：共享流程在FORMA维护，Git顺序在AGENTS维护；员工MD只定义职责/触发条件并引用共同适配；配置与启动模板同步；文件可读、显式加载、原生触发分别报告。

全局约束：
- 基线70170640b74c9067291eb2195aef17ca4a6a9fb3；开工远端main一致。已有六份MD来自同一01，逐文件SHA备份至D:/Forma/backups/team-superpowers-20261103-before，保留并纳入本轮审查。
- 01继续唯一lead/TASKS写者；不改他人员工记忆/status，不启动七个员工，不接管iPhone原写者，不操作Grok视频会话。
- 本次授权仅解除这批配置经审查后的Git上传限制，不授权业务、iOS修复、main合并、部署、生产、安装、凭据、真实收费或访问限制绕过。
- 只引用D:/AI-tools/skills/superpowers现有7.0.2 / 22f0b463e7a5e579904dd6211a520321035526f7，不修改上游；Mac使用独立本机映射。

## 实施步骤

1. 技能登记：更新 skills/registry.json、team-config.json、SKILLS-MATRIX.md，保留旧技能；新技能用superpowers:命名，登记来源、版本、资源hash和跨平台换行策略。更新scripts/forma-skills.cjs，保持只读list/read，不执行第三方脚本。
2. 员工规则：更新七份agent-prompts编号MD、current入口、三份Claude适配器、TEAM-ROSTER；增加共享Superpowers适配说明，清除权限表达歧义，区分首次只读接手与已有任务执行。不代写本人私有记忆。
3. 启动与验证：更新scripts/prepare-forma-chat-prompts.cjs和生成的七份launch/START-PROMPTS；补充分支/基线/唯一writer、技能检查、证据和review双结论。增强scripts/verify-forma-team.cjs并用独立临时目录验证读取器的hash/换行/缺失与Mac映射边界。
4. 本机验证：配置Windows/portable、每角色list、新技能read及资源校验；生成器重复执行无差异；检查链接、diff、七身份、旧记忆和业务树不变。不得把portable检查称为Mac实机或原生触发验证。
5. 独立审查：本地精确提交候选，不先push。新独立审查员用明确BASE/HEAD和本计划审查需求符合性、质量/安全，记录本人验证与未验证项；只写自己的新报告。01修发现，新SHA交其复验。
6. 通过后：再次核远端，正常推本配置分支并核SHA；不合入main，不重启网站。报告分支、SHA、审查证据和未验证边界。

## 审查重点

跨平台路径/CRLF；缺技能或资源hash不符不得伪称加载；旧技能保留；不得因Superpowers扩大工具权限/启动员工/删除旧工作；审查固定真实差异且保留失败；生成器与员工定义不得互相矛盾。
