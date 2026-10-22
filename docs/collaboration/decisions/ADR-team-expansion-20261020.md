# ADR：Forma 扩展员工池与首次任务

日期：2026-10-20（America/Los_Angeles）。Owner：lead。状态：配置决定；任务执行尚未开始。
依据：用户明确要求“更多的员工加上去给我看看，给他们任务”；已读取 team-composition-patterns v1.0.2（本机下载的 SKILL.md）。

## 决定

保留 lead/frontend/backend/qa/rules，增加 dot/product/ux/research/security/release，共11个角色身份。数量指可按需选择的员工池，不要求11个常驻进程；每个任务通常选2–4名有明确职责的员工。当前唯一技术派工与契约负责人仍是lead。

- Dot：需求收件和状态摘要；Product：验收规格；UX：交互规格，Frontend：界面实现。
- Research：官方技术证据；Rules：确定性健康领域规则；Security：数据隔离，QA：功能与回归验收。
- Release：发布准备报告；实际发布与资源操作不属于首次任务。
- 建议工具不自动重派现有会话、工作目录或源码。保留所有既有源码负责人和独立worktree。

TASKS是唯一派工/所有权来源；每个新增角色只写自己的deliverables、status和memory。lead仅在TEAM-EXP-01初始化六个新角色的缺失种子；之后由本人维护。旧角色记忆只读，旧MEM-01不据此虚假结案。

## 首次任务及集成

首次任务是证据、复现、体验规格与Web准备检查，详见TEAM-DOT/PRODUCT/UX/RESEARCH/FRONTEND/BACKEND/QA/RULES/SECURITY/RELEASE-01。未开始任务保留todo；UX和Release在依赖未交付前blocked。任何产品修复必须另有lead派发的源码范围与契约决定，不把初步报告当作已完成修复。

接手前同步已审查配置到对应checkout，确认ID、分支、任务依赖与未提交内容。不得由本轮直接跨目录修改现有worktree；配置不会启动或通知外部聊天，也没有建立跨Dot/Codex/Claude Code自动通信。Dot尚未验证可读写仓库，只能先交草稿供lead导入。

## 取舍和边界

技能中的team-lead/team-reviewer类型可能偏只读，不能直接充当需要修改共享文件的Lead或需要写测试的QA。实际工具权限在接手时按现有项目范围配置，不假定下载单个Skill就安装了Agent Teams运行时。角色分工不是模型能力排名。

不新增数据库、模型API、服务、付费依赖或后台守护程序；不变更健康、隐私、许可、版本历史和开发端口规则。QA后续必须验证包含实际变更的同一候选提交，历史测试不能替代新验收。
