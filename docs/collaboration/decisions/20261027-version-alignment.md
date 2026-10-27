# 2026-10-27 共同版本与任务状态入口

Owner：01 lead。任务：VERSION-ALIGN-01。依据：用户本轮明确只执行计划第1项，对齐Windows、Mac、GitHub并保留现有改动，其他步骤不执行。

1. 共同分发入口使用GitHub `Devinshen123/forma-health`的`main`；01现有`codex/fud-food-photo-20261022`保持为本人的集成分支。旧Mac handoff分支仅为历史，不再是推荐同步入口。当前SHA以最终同步回执为准。
2. 保留并合入原Windows main的02既有3次纯文档提交；保留01未推送的4次交接文档提交。`da6cda9c85caa17f5066dc5165d8f79122d0cdd2`的两个父提交使两边历史都可追溯。本轮不合入iOS修补或任何业务候选。
3. `docs/collaboration/TASKS.md`仍是唯一正式任务板，顶部2026-10-27状态汇总优先于历史切片。按已核实结果纠正“Google未开通”“健康基础待开发”等过时说明，但不将本机成功写成正式上线或真实健康同步成功。
4. 原目录不迁移；未提交删除和未跟踪文件保持原样。先确认既有writer停写，再正常快进；拒绝直接改checkout中的分支ref、强推、硬重置、clean或自动stash。Mac没有实际连接/状态回执即记未知，不能用准备说明书代替同步完成。
5. 已提交的Claude请求与记忆按原内容合入，不代改02记忆或启动其会话。07/08、CHAT-*及新增健康平台仍为后续范围，本轮不新增岗位、派工或安装技能。
6. 本轮只做Git/文档同步。唯一工作流`.github/workflows/ios.yml`的push分支为iPhone分支，且限定iOS相关路径；本轮main/主管分支仅同步文档，不修改工作流、不创建PR或手动触发CI。没有网页部署或账号开通动作。

核实方式：保留两个提交祖先、业务树无差异、原目录未提交文件hash保持、GitHub分支与TASKS blob一致；Mac必须有相同SHA/blob的实际回执。详见[WORKSPACES](../WORKSPACES.md)。
