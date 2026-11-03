# Forma C盘旧副本安全清理回执

01 / lead；2026-11-03，America/Los_Angeles；任务FORMA-C-CLEANUP-20261103。实际源码/命令目录D:/Forma/source，分支codex/fud-food-photo-20261022，起点0ebb56f7e900e1c8fd677f723c970701e73d3ba3。同一01唯一执行，用户明确授权核验D盘后清理C盘旧副本；旧“保留C盘”要求已被本次指令替代。没有启动员工、实施业务、进行真实提供商登录或部署公网。

## 结果与D盘现状

- 网站、数据库、附件和私有配置仍使用D:/Forma/source；启动器D:/Forma/Start-Forma.ps1。
- 清理15个C盘旧目录，包含原主仓库、11个关联worktree、3个旧取证/测试运行目录。旧主目录和旧主管入口各只留678字节AGENTS说明；另13个目录已不存在，未建立C→D链接。
- 共206,151份原文件、9,880,354,801字节（约9.88 GB / 9.20 GiB）完整归档并逐文件SHA256校验。删除前再次全量核对源文件内容、清单及链接，全部一致。
- 清理后D盘35张数据库表的逻辑内容与本次新备份逐表完全一致；SQLite quick_check、外键、配置及HTTP复查通过。
- 源码/服务端业务、依赖锁及功能未修改；本回执和当前路径说明按根AGENTS正常提交/推送。最终GitHub提交、运行标识与进程以交付前实测为准，不把起点版本或PID当永久值。

## 私有备份（不能上传GitHub）

根目录：D:/Forma/backups/c-cleanup-20261103，权限限当前用户、SYSTEM和管理员。

| 子目录/资料 | 内容 |
|---|---|
| active-d-data | SQLite在线一致性备份、全部4个附件文件、私有环境配置、结构/内容校验记录 |
| legacy-main | 旧C主仓库全部普通文件，包括.git、忽略文件、私有配置、数据、依赖及未提交工作 |
| legacy-worktrees | 11个旧C工作区的完整文件，Git位置已修复至D盘归档主仓库 |
| legacy-artifacts | 3个旧Forma取证/测试运行目录 |
| git-admin-before-repair / raw-linked-gitfiles | Git管理资料与关联文件的修复前原件，保留全部本地历史、引用与索引 |
| retained-d-worktree-before-repair | 保留D盘历史工作区的修复前安全副本 |
| 清单与回执 | 每个文件的私有大小/SHA、原HEAD/dirty状态、复制/验证/清理日志；不在公开文档展示内容 |

此前D:/Forma/backups/migration-20261102完整保留，没有覆盖或清除。运行数据与新备份均未被旧C数据覆盖。

## 实际清理目录

| C盘旧位置 | 结果 |
|---|---|
| C:/Users/devin/健康网站 | 仅保留AGENTS跳转说明 |
| C:/Users/devin/.codex/worktrees/fud-food-photo/健康网站 | 仅保留AGENTS跳转说明 |
| C:/Users/devin/.codex/worktrees/7f7e/健康网站 | 已删除、D盘归档保留 |
| C:/Users/devin/.codex/worktrees/9260/健康网站 | 已删除、D盘归档保留 |
| C:/Users/devin/.codex/worktrees/bdd7/健康网站 | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-confirmation-boundaries | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-health | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-record-flows | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-review-recovery | 已删除、D盘归档保留 |
| C:/Users/devin/健康网站-worktrees/backend | 已删除、D盘归档保留 |
| C:/Users/devin/健康网站-worktrees/frontend | 已删除、D盘归档保留 |
| C:/Users/devin/健康网站-worktrees/review | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-claude-evidence-20261017 | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-evidence-20261017 | 已删除、D盘归档保留 |
| C:/Users/devin/Documents/Codex/2026-10-16/task-2/forma-task-runtime-20261017 | 已删除、D盘归档保留 |

没有删除空的共同父目录、其他项目、系统Node、Codex应用或全局工具/缓存。读取到的C盘相关进程是Codex工具运行时，其中另一组属于无关项目；未结束它们或其他编辑器。本站服务确认使用D盘绝对入口和.env，清理期间持续可访问。

## Git关联保护与实际验证

旧C主仓库是多个工作区的common Git，其中D:/CodexTaskData/claude-forma-docs-20261019仍依赖它。先备份全部普通文件与原始Git管理资料，再按[Git官方worktree repair说明](https://git-scm.com/docs/git-worktree#Documentation/git-worktree.txt-repairpath)修复D盘归档主仓库和所有新位置：13个工作区HEAD及未提交状态均与原件一致，git fsck --full退出0，common dir全部在D盘。D盘现用独立主源码Git连接性检查退出0，没有C盘objects alternates。fsck的dangling历史对象提示不等于损坏；对象原样保留，未清理Git对象。

3个旧node_modules目录链接先在归档中改指向D盘对应依赖；删除C盘时仅移除链接本身，不递归穿透。每个删除目标使用硬编码允许清单、解析后的绝对路径与祖先reparse检查，源文件再次全量SHA匹配后才删除；未用reset/clean/stash、强推或恢复旧删除意图。

| 本轮实际检查 | 结果 |
|---|---|
| D盘当前SQLite在线备份及原库quick_check / foreign_key_check | 均通过，外键错误0 |
| 保存JSON及私有附件 | JSON有效；全部4文件备份SHA匹配，没有缺失的数据库引用附件 |
| 清理后逻辑数据 / 配置 | 35张表逐表内容与新备份相同；.env字节相同，不输出内容 |
| C源与D归档 | 206,151文件SHA全部相同；删除前再次全量源内容校验通过 |
| Git历史/dirty/index关联 | 13个工作区HEAD和dirty状态一致、对象检查通过；原始管理资料另存 |
| 动作库构建媒体 | dist下11,328文件大小/SHA全部匹配既有清单 |
| 网站 / 视频 / 匿名账户接口 | 首页200、实际MP4 HEAD200、/api/state匿名401 |
| 私有URL | /.env及/data/forma.sqlite只返回与首页相同的公开SPA壳，不返回私有文件；不是404 |
| C盘清理结果 | 15目标完成；两个678字节说明文件保留，其余13目录不存在 |
| 清理后的配置与文档 | Windows配置15/15；保留已知agent-development缺少test-agent-trigger.sh的警告；本次10文档88个相对链接存在、凭据格式扫描无匹配、diff检查通过 |

C盘可用空间观测从18,897,866,752增至31,218,089,984字节，增加约11.47 GiB；该整盘差值也可能包含系统和其他进程变化，不冒称全部由本任务释放。可归档核对的旧文件逻辑大小为9,880,354,801字节。

初次诊断误用了不存在的/api/release-info路径，已改正确/release-info.json；部分临时检查遇到PowerShell管道、大小写不区分的HOME只读变量及内联引号解析错误，均在检查脚本修正后重新通过。没有因此重置数据、绕过验证或把失败当成功。复制器robocopy退出1表示成功复制；脚本已单独核对，不能把它当复制失败或忽略>=8的失败值。本轮未改业务，不重跑无关全套产品测试；不替代06独审、Mac实机或真实提供商验收。

## 后续使用与恢复

日常只从D:/Forma/source工作，文件/下载默认D盘，每次完成修改验证后正常同步GitHub。Codex现有聊天/项目界面可能仍显示旧C位置，应由用户选择D:/Forma/source打开；本次没有冒称自动修改应用绑定或其他机器。

需要恢复旧改动时，先保存当前D数据，再在另一个D盘目录按私有清单恢复并修复Git位置；只选择性审查移植所需改动，不把归档旧MD、数据库或分支覆盖现用源码。恢复涉及私有数据时不使用公开GitHub传输。
