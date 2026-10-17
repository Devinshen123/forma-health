# Forma 项目级三聊天与独立 worktree

日期：2026-10-17，America/Los_Angeles。

用户明确选择“项目下三个独立聊天，各用 Git worktree 隔离”。在项目“运动健康网站”（d36625d2-8cc7-4654-9649-760091abb48d）创建 Forma 前端开发、Forma 后端开发、Forma 代码审查；原总控聊天也已加入同一项目。

每个新聊天使用本机托管worktree，默认起始状态由项目工具决定，不擅自指定新起点或拉入尚未合并修复。初始消息明确完整角色边界、原目录AGENTS读取位置和只读接手范围。各角色不能写原目录、彼此worktree或共享契约；总控处理集成。

此前三个当前聊天子代理已经完成并结束，交付155/155测试、成功构建及接手盘点；不把它们说成项目级长期后台任务。新聊天首轮仅核实checkout/分支、记录自己的接手状态并停止等待具体任务，不自动实施产品改动或周期工作。

共享目录接手期间，QA提交66a0f00意外纳入frontend同时暂存的两份文档；没有产品源码，已保留历史并由frontend在ddbd4bd补记。后续三个独立worktree避免共享索引；总控提交仍使用精确路径。

## 实际创建与验收

| 聊天 | threadId | worktree绝对路径 | 首轮提交 |
|---|---|---|---|
| Forma 前端开发 | 01a148dd-26a1-7812-a1fd-e10d8f096bd5 | C:/Users/devin/.codex/worktrees/bdd7/健康网站 | cfa66ce |
| Forma 后端开发 | 01a148dd-3a73-7261-b95c-433fb7d3bbc6 | C:/Users/devin/.codex/worktrees/7f7e/健康网站 | ecb5012 |
| Forma 代码审查 | 01a148dd-4bf0-7eb0-9289-48288bef781c | C:/Users/devin/.codex/worktrees/9260/健康网站 | 835f53d |

三个聊天均实际返回接手就绪、无阻塞并结束首轮。工具创建的是detached HEAD（起点ddbd4bd），没有命名分支；保留工具管理状态，不伪称已有命名分支。lead随后将本项目AGENTS和最新TASKS规则快照放入三个checkout，避免后续读取上级家具项目规则或旧分工；不复制.env、健康数据、参考仓库或未授权工具文件。
