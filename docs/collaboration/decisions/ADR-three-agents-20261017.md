# 当前聊天三子代理分工

历史决定：用户随后改选项目下三个独立聊天、各用worktree。本文件保留原接手轮事实，最新决定见ADR-project-worktrees-20261017.md。

日期：2026-10-17，America/Los_Angeles。

用户要求设置前端、后端和代码审查，并直接选择“当前聊天里的三个子代理”。lead在本聊天启动frontend、backend和code_review；不创建侧边栏独立聊天。

frontend合并shell与features；backend保留server（排除rules）和storage；code_review独立只读产品代码、负责基线和评审。lead保留公共类型、API客户端、同步engine与配置。精确路径以TASKS顶部表为准。已有完成角色的本目录范围由新角色接手，Claude rules保留。

首轮仅接手、盘点和验证，不根据“设置”自动扩大到产品重写。其他隔离目录的Forma修复不自动合并，不更改其他聊天工作状态。只启动一轮子代理，不能宣称后台长期常驻或自动反复工作。
