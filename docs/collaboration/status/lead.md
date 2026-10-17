# Codex lead 状态

2026-10-17 R-01–R-04 done（第二轮）。新 worktree `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-review-recovery`，分支 `codex/forma-review-recovery-20261017`，基线上一轮 `874b13cac7db203d7c36db0191e9c2490fe1f55a`。先实际复现 5 个失败场景后修复三组问题：AI 批次不确定保存覆盖/复活及候选集合改变、逐组历史校正自身重试被拒、训练结束审核后台更新后勾选未失效。前端增加批次成员/值快照保护，首次尝试后固定照片与候选集合、允许同 ID 数值校正，明确可能已保存/待同步；历史校正沿用 RecordDraft，版本变化清除审核。

后端任务由独立工作者完成，唯一写 server/review-recovery.test.ts：4 项真实 HTTP 回归验证 AI 原始来源、多项原子提交、共享照片与旧 receipt 重放、active→finished 的 400/409 回滚、校正与重启幂等。未发现明确后端产品缺陷，未为凑前后端变更修改接口/数据库/权限。浏览器联调通过真实 /api/assets、/api/food-photo-drafts 和 /api/sync，将页面反馈与服务端事实核对，AI transport 全部原始 mock Response，无付费调用。

已执行：`node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` 198/198、0 失败/跳过/取消；`npm run build` 成功，shell 8e214ee1e8811712（既有训练分包体积提示）；`git diff --check` 通过。系统 Edge 单浏览器串行专项 12/12，pageerror 0、console warning 0，只有注入响应丢失的网络错误与 mock 无效输出对应 502。1440×1000 / 390×844 截图复看，无横向溢出。WebKit executable 不存在，未安装或冒称真机 Safari/iPhone。AI/训练独立只读复审未发现修复新增阻塞。

日志、修复前后 JSON、截图与可复跑脚本保存在 `D:\CodexTaskData\forma-review-recovery-20261017`，完整前后端清单及限制见 QA.md。测试并发 1、Edge 禁 GPU/compositing，TEMP/TMP 仅命令进程指向 D；依赖目录联接，不安装依赖或改全局设置。验收浏览器与 fixture 均关闭，3001/5173 无本轮监听；未占用或关闭 Showroom/视频服务、未清理其他文件。

仅本地提交，不 push/PR/合并/部署；原仓库、上一轮 worktree 与 AGENTS 副本均保留，真实数据/附件、.env、健康接入、Apple/HealthKit 和生产迁移未操作。范围边界：旧删除/放弃确认的并发行为未专项验证，未新增删除后撤销；真实供应商/生产、Safari/iPhone 未验。JSON 只含记录和附件引用/元数据，不含文件本体；设置导出不含未同步改动，待同步导出也不是完整附件备份。无本轮执行阻塞或待用户决定项。

2026-10-17 F-01/F-02 done。新 worktree `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-record-flows`，分支 `codex/forma-record-flows-20261017`，基于 PR #1 head 500e66b（开工核对仍 OPEN/DRAFT、main eb6b559）。先实证复现并报告三类问题：旧饮食表单覆盖/复活及过时删除确认、活动自身不确定保存无法在原表单校正、偏好切单位重解释已打开负重。增加记录草稿快照及自身提交识别，草稿固定单位；未改服务端/API/权限或依赖。

验证：串行 `node --import tsx --test --test-concurrency=1 server/*.test.ts server/rules/*.test.ts tests/*.test.ts` 191/191；`npm run build` 通过（既有训练分包大小提示），shell 5cd67b87961bf8f8；真实系统 Edge 8/8、pageerror 0，1440/390 截图复看、移动端无横向溢出。D 盘 `D:\CodexTaskData\forma-record-flows-20261017` 保存 baseline-confirmed/final JSON、截图及 final-tests/build/browser 日志。可复跑浏览器脚本在 tests/browser/record-flows.mts。独立只读复审无新增阻塞，未启动额外测试/服务。

本轮限制：GPU 禁用，测试并发 1，TEMP/TMP 仅在命令进程指向 D 盘；复用依赖目录联接，不安装、不清理其他文件。合成数据库/账号与浏览器独立，结束后关闭本轮服务，不触碰 Showroom 或视频任务。原目录和上一轮 worktree 的未提交文件保留。仅本地提交，无 push/PR/合并/部署、真实数据/AI/Apple/HealthKit 或生产迁移。

剩余边界：AI 多项审核保存、逐组训练专项浏览器回归、Safari/iPhone 未在本轮验证；没有新增记录删除后撤销。JSON 仍不包含附件本体，须另保留原文件。完整说明 decisions/ADR-record-flows-20261017.md，无待用户决定的本轮阻塞。

2026-10-16 L-01/L-06 done。独立 worktree `C:\Users\devin\Documents\Codex\2026-10-16\task-2\forma-health`，分支 `codex/forma-local-safety-20261016`，基线 eb6b559。云端补丁未在本机，已重新核对并修复账号生命周期、待同步队列、附件、DST、训练导入与舍入。独立复审补获旧引擎重放已放弃删除、在途验证跨恢复、重复 key DOM 残留与对象字段顺序无效版本，均修复并回归。

验证：`npm test` 186/186，`npm run build` 通过，`git diff --check` 通过；最终 shell e477dc502d837645。独立系统 Edge 155 的 15 项真实浏览器场景全部通过，1440/390 截图复看；无脚本异常/console warning，只有故障注入对应网络错误。验收服务与浏览器均关闭。可重跑脚本/最终 JSON/QA 报告在 worktree 外 `../browser-evidence/`，测试和构建日志也在上一层；完整边界见 decisions/ADR-local-safety-20261016.md。

本轮中途因 Windows 授权撤回暂停，收到恢复授权后继续；未绕过限制。原目录仍为 eb6b559、原有七类未跟踪项不变；未读取原 data/、未载入原 .env、未启用真实健康/AI/Apple/HealthKit，无 push/远程分支/PR/合并/部署。仅保存本地集成提交，AGENTS.md 的隔离副本不纳入提交。

剩余边界：JSON 不含附件本体；未启用离线的队列仅在当前页面内存。旧漏导训练需原文件重导；Safari/iPhone、真实供应商源文件、真实 AI 与正式生产身份/数据未验证。保守保留不确定附件可能留下未引用文件，本轮无自动清理。无待用户决定的本轮阻塞。

2026-10-15 G-01 done。人类直接要求将网站放在GitHub；已使用登录的Devinshen123账号创建私有仓库https://github.com/Devinshen123/forma-health ，HTTPS origin与main上游已设置，git push成功，GitHub API确认PRIVATE/非空/默认main且远端SHA与本机HEAD一致。未改写历史或force push。README新增仓库链接、克隆和运行说明。

验证：原main全部19次提交、134历史路径、208唯一blob（200文本＋8PNG）独立只读审查，无真实secret、非.example环境文件、数据库、uploads或reference-sources路径；无SQLite签名，PNG无嵌入文本/EXIF元数据，既有截图来源为演示/合成记录，本轮没有新增像素OCR。候选均为测试夹具/属性而非真实凭据。git check-ignore确认.env/data/reference-sources/node_modules/dist排除；npm test155/155、npm run build通过（现有训练分包大小提示），git diff --check通过。

本次只上传源码/测试/文档和公开演示素材，不上传本机账户记录、附件、真实密钥或其他所有者未跟踪工具文件。GitHub代码托管没有启用公网网站部署或付费资源。

2026-10-14 T-01 done。用户直接授权五组训练能力，本轮在原网站增量集成884条动作文字与8项原创示意、星期/循环模板、实际逐组/超级/递减/可恢复休息、PR/e1RM/人审进阶/肌群统计、审核导入及实体同步。来源许可证记录、REA部分覆盖、API契约与当前限制已写入文档，未复制openGym代码或媒体。

验证：npm run build成功（训练按需分包187.69KB gzip有大小提示）；npm test155/155、0失败。实际IAB合成账户完成计划→逐组→计时暂停刷新→核对结束→CSV去重→证据进阶，停止本次自有服务证明断服务刷新与队列持久化，恢复后与另一客户端记录合并，同记录40/55冲突由人审选择。1440/390px中英通过、无横向溢出、90秒首帧和未保存跨页提示已复验。完整记录见docs/VALIDATION.md。最终只读审查补上离线IDB返回后二次核对active-account marker、在线boot固定账户；静态壳当前版本fallback也已修正，重新build通过，npm test再次155/155；退出浏览器并精确核验后清理唯一合成验收账户，本机服务恢复运行，交付训练演示入口。

当前界限：8项原创示意不等于884个动画；其余有文字。共享服务同步机制已验，本机监听不等于手机跨设备部署。供应商CSV格式限定，未验证全部真实文件；iPhone/Safari/VoiceOver、公开HTTPS托管、Apple登录/HealthKit/TestFlight尚未实测或实现。真实AI密钥未配置，没有付费调用。

待用户决定：运营预算/服务地区/供应商、后续部署与Apple会员签名。用户已选保持当前测试额度，维持10次/账户/UTC日，不能采纳Claude转述为新预算。上述决定不阻塞本机网站交付。

以下是此前交付的历史记录。

2026-10-14 AI-01 done。用户要求AI识图，选择“先完成接入，稍后配置密钥”。服务端真实Responses adapter与独立草稿、逐图同意/校正保存、双语状态、持久账户/项目预留已集成。AbortSignal上传冻结账户标记，Nutrition按账户重建，.env仅后端加载。Claude Code真实设计brief评审已采用费用/同意凭证建议；另一个独立Claude rules纯函数交付已纳入测试，尚未运行对接。

验证实际运行：npm install sharp成功/audit0；npm test99/99（原11+AI46+rules42）；最终npm run build TypeScript/Vite成功；git diff --check无错误。IAB真实夹具闭环200g/260kcal与AI来源，Edge1440/390证明未知保留、原草稿不改、失败手动保存，pageerror0/无横向溢出。截图发现审核区不醒目、checkbox缩水后修复focus/sticky/18px并重跑同一流程通过。实际127.0.0.1:3001已启动，capabilities not_configured，IAB入口可见控制台空。临时fixture进程/数据核验后清理，未碰人类数据。官方视觉/StructuredOutputs/模型页已打开，固定5.4-mini快照，未输出或设置真实密钥。

2026-10-14预算核对已收到直接答复：“先保持当前测试限额，预算稍后确认”。已记录ADR-budget-test-limits并回写Claude请求、TASKS和COSTS；程序默认10次/UTC日、账户US$0.40/日、项目US$2/日预留均维持。本次只更新文档，git diff --check通过，不重复运行未受影响的程序测试。

待用户决定：密钥稍后配置到本机.env，真实服务地区与运营月预算仍待决定。Claude转述75美元/月、1.5美元每人AI/月、15次/日未成为已确认预算。M1优先实体/会话/服务端提议契约与rule evidence对接；真实模型照片质量仍待实测。

2026-10-13。本机网站M0已实现，最终3001构建后运行和截图验收已完成。TypeScript/Vite构建通过；后端代理最新11个HTTP/SQLite测试通过（含跨标签身份绑定）。内置浏览器已用合成账户实际保存引导、半份260kcal＋私有照片、45分钟训练、跨午夜7.5小时睡眠、30分钟候选接受/补偿撤销、周复盘及原报告符号<0.5；英文切换通过。

修复：409重载、sessionEpoch阻断旧请求、跨标签请求身份header＋storage通知、boot异步身份检查、删除后二次注销、上传取消清理、日期输入即时事件、手机hero断行、h1默认字号。已读共享Claude评审并在其请求回复，M1架构迁移与M0真实性边界记录ADR。

当时阻塞/未实现（M0历史快照）：AI/OCR、云同步、Apple登录、iPhone/HealthKit/TestFlight、正式发信、地区与预算。当前未购买资源或发布生产。无需再问是否允许先做网站，已有明确人类授权。

待用户决定：外部服务月预算与供应商/服务地区、健康摘要或原始上云范围、Apple会员/签名；这些不阻塞本机记录体验，但阻止擅自启用付费与声明双端MVP完成。

