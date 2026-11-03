# Forma D盘迁移回执

2026-11-02（America/Los_Angeles）；唯一执行者01 / lead，任务FORMA-MOVE-D-20261102。起点05958dd5263a3bc9545594301cb94c783f7dcad7；当前源码和工程命令目录D:/Forma/source，分支codex/fud-food-photo-20261022。此为存储/启动配置迁移，src/及server/业务源码未变，不实现支付或旧日期/报告修复，也不替代其独审。

## 新位置

| 内容 | Windows位置 |
|---|---|
| 主源码、node_modules、dist及运行入口 | D:/Forma/source |
| 私有配置、数据库/附件 | D:/Forma/source/.env、D:/Forma/source/data |
| 下载、npm缓存/临时 | D:/Forma/downloads、D:/Forma/cache/npm、D:/Forma/cache/tmp |
| 日志、私有备份 | D:/Forma/logs、D:/Forma/backups/migration-20261102 |
| 本机启动 | D:/Forma/Start-Forma.ps1；旧AI-tools入口也转发同一脚本 |

现有Node程序本体未迁移；其他项目/系统全局缓存未改。本项目新产物默认D盘，执行构建/测试时进程级TEMP/TMP/npm缓存也指向D盘。Mac不套用盘符。

## 实际保护措施与迁移

1. 从原共同Git仓库复制已有主管分支，使用--no-hardlinks建立独立D盘Git，origin改回既有GitHub仓库并正常fetch。D盘.git是独立目录、objects没有C盘alternates；没有改原C分支或索引、强推/reset/clean/stash。
2. 原C未提交工作按实际Git清单复制到D盘私有备份：277份文件逐项SHA校验，另保留1项删除意图及原HEAD/状态清单。未把旧分支的文件或删除覆盖到新源码，C原件仍在。
3. 沿用同机现有依赖，复制前比较三个package-lock；动作素材从旧发布包dist中的实际位置复制，经现有校验器验证5,632动作/5,632视频和11,328份媒体/内容SHA。原项目本机技能复制到D盘，agent-development目录现为D:/Forma/skills/agent-development，未擅改第三方技能正文。
4. 停止已确认的旧Forma PID11568后，复制完整data目录到D盘私有备份及D盘运行目录。7个文件共2,385,776字节，原件前后及两份目标的相对路径/大小/SHA清单一致，包含WAL/SHM；私有.env逐字节相同。没有选择/打印真实账户或健康记录。新.env、数据及备份/日志使用收紧的NTFS权限。
5. 复制后只执行SQLite PRAGMA quick_check，返回ok；随后新D源码启动成功，首次切换PID49804，URL仍127.0.0.1:3001。命令行明确使用D源码绝对入口与D配置，数据参数由启动器显式指向D:/Forma/source/data。最终进程/运行提交以交付前复核为准。
6. 新根AGENTS、FORMA/CLAUDE/README、WORKSPACES、共享团队配置和八份启动Prompt默认D盘；旧C主仓库及旧主管worktree的AGENTS只加转向D盘的通知。旧历史资料、原worktree、其他员工日常记忆和Mac均未冒称同步或接管。

## 已执行验证（非历史结果）

| 检查 | 实际结果/范围 |
|---|---|
| 旧未提交工作备份 | 277文件SHA匹配、1删除意图；原复制期间状态及内容稳定 |
| 动作素材 | 11,328文件SHA通过；不是仅检查目录存在 |
| 团队配置 | Windows与portable分别15/15；portable不证明Mac实机或外置技能安装 |
| 技能 | 12/12可读、110资源；保留已知缺失scripts/test-agent-trigger.sh警告，不伪称补齐或原生触发 |
| 产品单元/HTTP测试 | D盘执行npm test，429/429、fail/skip0；在私有.env复制前执行，未调用真实提供商 |
| 源码发布策略最小新增回归 | 新增精确Windows启动脚本白名单后专项3/3，继续拒绝任意/隐藏PowerShell及私有导出 |
| 完整构建 | D盘npm run build通过：类型检查、网站、训练工作台、伙伴乐园、1038文件源码包和离线壳；原有大chunk提示不是迁移失败 |
| 私有存储 | 7文件完整校验、.env相同、SQLite quick_check=ok；真实提供商/健康事实未另测 |
| 运行就绪 | 首页及实际动作视频HEAD200；新进程绝对入口/环境文件均在D盘；新旧两个启动入口可重复运行而不重复启动 |
| 私有URL检查 | /.env及/data/forma.sqlite返回200公开SPA壳，响应内容与首页完全相同，未返回私有文件。不能将HTTP200单独当泄漏或声称返回404 |

所有构建/测试日志在D:/Forma/logs，私有传输清单在D盘备份，仅公开统计，不上传清单内容、.env或数据库。后续只修改回执时不重跑整套产品测试；交付前更新构建标识/离线清单并以实际最终运行版本核对。

## 调整和未做的事

- 初次素材复制误用旧release/public路径，发现不存在后停止该阶段；改用已存在的dist/exercise-media并重新做完整SHA校验。数据库当时尚未切换，网站未中断。
- Prompt批量路径替换初次把绝对路径再次拼接，文件写入因无效路径被拒绝；改为Resolve-Path后完成，未覆盖其他路径。
- 首次构建因新增.ps1不在发布白名单而失败；精确加入这一脚本，并新增拒绝任意/隐藏.ps1的回归后重新完整构建通过，没有放宽为所有数据文件。
- 私有URL首次检查错误要求404，实际为SPA fallback；已按现有静态服务测试约定核对公开HTML全文相等，不将错误检查写成成功或实际泄漏。
- 未删除C盘原件、旧发布包或其他linked worktree，不承诺已释放它们占用的C盘空间。C盘AGENTS之外旧工作文件保留；未审核旧改动存放私有备份，未自动合入源码。
- Codex app项目/附件仍可能记录旧C位置，本工具没有把所有聊天关联自动改为D项目；当前01工程操作已显式切D，旧入口已指向D。以后在界面打开项目时选择D:/Forma/source，不能同时新开第二名lead。
- 没有启用收费、申请账号/权限、安装新依赖、登录Apple/Claude、真实照片识别或设备同步、CI或公网部署。原日期/报告任务仍待独审/实施，迁移不是它们完成的证明。

## 回退与后续

原C数据/.env和旧启动器/指针的私有备份均保留。若需回退，先核对并停止确属本站的新进程；若用户已在D盘产生新记录，必须先保存这些新数据并设计一致性回退，不能直接用旧C数据库覆盖。不要把两个副本同时启动成两套正式账户库。

最终迁移提交及完成回执正常同步main/主管分支，交付前通过ls-remote与GitHub文件blob核对；实际SHA见所属提交和最终回复。新主目录后续沿根AGENTS每次修改验证/提交/push，不再等待重复提醒。
