# Forma 员工独立记忆使用说明

更新：2026-10-20（America/Los_Angeles）。共享规则见 [AGENTS.md](../../../AGENTS.md)，权限与任务见 [TASKS.md](../TASKS.md)。

## 员工目录

| 员工 | 专属目录 | 主要记忆内容 |
|---|---|---|
| lead | [lead/](lead/PROFILE.md) | 目标拆解、契约取舍、依赖和集成经验 |
| frontend | [frontend/](frontend/PROFILE.md) | 设计、交互、双语、空状态与界面边界 |
| backend | [backend/](backend/PROFILE.md) | 会话、持久化、上传、版本/幂等和错误路径 |
| qa | [qa/](qa/PROFILE.md) | 复现方法、验收证据和未验证范围 |
| rules | [rules/](rules/PROFILE.md) | 确定性领域计算与健康安全规则，按需加入 |
| dot | [dot/](dot/PROFILE.md) | 用户需求来源、进度摘要和待决事项 |
| product | [product/](product/PROFILE.md) | 用户流程、范围与可观察验收 |
| ux | [ux/](ux/PROFILE.md) | 交互规格、中英文案与视觉证据边界 |
| research | [research/](research/PROFILE.md) | 官方技术来源、本机验证与未知能力 |
| security | [security/](security/PROFILE.md) | 合成账户的隔离验证与安全发现 |
| release | [release/](release/PROFILE.md) | 候选版本、验证依赖、运行和回退清单 |

每个目录有 PROFILE.md（身份）、MEMORY.md（长期经验）、HANDOFF.md（下次继续）。这是项目中的文件记忆，按角色分开管理；不是私密空间或自动聊天记忆。其他角色按需可读，仅本人日常写入。

## 新会话怎么接手

在对应员工的独立聊天中使用以下开场白，把 frontend 换成目标角色 ID：

> 你是 Forma 的 frontend。读取本 checkout 的 AGENTS.md 和 docs/collaboration/agent-prompts/current/frontend.md；再读 TASKS、自己的 PROFILE/MEMORY/HANDOFF、status 与发给自己的请求。先核对 checkout、Git 状态和实际源码；只处理明确派给你的任务。先前记忆不是本轮实测，完成一步或遇到阻塞时更新自己的 status 和 HANDOFF。

先同步已审查的配置提交，再开始接手。旧 worktree 的未提交文件不会自动更新，不能直接往其他 checkout 复制整个目录。如果存在未提交工作或冲突，由本人记录并交给 lead 安排集成。

没有分配任务时，报告身份、目录、接手结果与阻塞，然后等待；不要重新执行 2026-10-13 首轮初始化或新建基线，也不要自动启动其他员工。

## 写什么

- PROFILE：当前身份/专长/职责/习惯/成功标准。工具名称不改变角色 ID。
- MEMORY：简短、能复用的知识，附日期、状态、来源、适用范围。示例：某个超时如何复现、哪条 ADR 限制了设计选择。
- HANDOFF：任务 ID、checkout/分支/基线、已完成/未完成、命令/退出码、阻塞/请求、下次第一步、待用户决定。
- status：向团队汇报；TASKS：唯一派工；decisions：跨角色正式决定。记忆通过链接引用它们，不复制全部内容。

长期记忆条目模板：

> 日期：YYYY-MM-DD；状态：已验证 / 待验证 / 已过期 / 已替代  
> 事实或经验：一句话。  
> 来源：相对路径、提交或实际命令；执行者。  
> 适用范围：checkout/版本/条件；限制：未验证什么。  
> 替代来源：有新证据时填写。

## 保存与交接

1. 更新本人 status 和 HANDOFF；将本轮可复用经验压缩进 MEMORY。
2. 精确暂存本人文件，检查 diff，再用 [角色] 开头提交；不提交其他人的暂存内容。
3. lead 审查、集成；其他 checkout 显式同步审查过的提交。同步失败/冲突时保留现状并写请求，不自动覆盖。
4. 上下文压缩或换会话后重新读取记忆。旧条目作废时标注替代来源，长历史可放本人 archive/ 并留索引。
5. 每个角色同一时刻只有一个写入者。新增员工或更换 owner 先登记 TASKS，不让两个会话抢同一目录。

MEM-01初始化原五个角色；TEAM-EXP-01仅初始化新增的dot/product/ux/research/security/release六个角色。之后各角色本人维护，lead不日常代写。完整名单见 [TEAM-ROSTER.md](../agent-prompts/TEAM-ROSTER.md)。

本轮仅创建当前 checkout 的配置和种子记忆；没有通知、重启或验证其他聊天已采用。所有种子中的历史事实均有文档来源，接手者仍需核对自己的版本。

## 内容边界

只写开发必要信息。禁止保存真实健康记录、账户个人信息、照片内容、密钥、token、cookie、密码、.env 内容或无关个人/其他项目对话。使用合成数据、脱敏摘要与代码/测试引用。记忆目录可能随源码提交和公开，不能用于存放秘密。

共享规则、TASKS/ADR 与实际代码证据优先于旧记忆；发现冲突先核实、标注过期。记忆不能批准付费、部署、扩权，也不能证明员工在后台运行。
