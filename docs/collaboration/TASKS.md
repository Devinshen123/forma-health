# Forma 协作任务板

更新：2026-10-13，America/Los_Angeles。当前人类明确授权是“我暂时还不知道你先把网做出来”，同时确认 US$20/月和已有 Mac/iPhone。网站本机实现已获授权；付费、生产发布和 iPhone/TestFlight未据此自动获准。早期 predevelopment 的 C08/G01 是旧阶段快照，不能覆盖这条后续人类指令。当前运行与需求事实以根 README、docs/PRODUCT-PLAN.md 和用户最新指令为准。

## 本里程碑所有权（优先于 AGENTS 默认角色表）

| 参与者 | 当前可写范围 | 状态 |
|---|---|---|
| Codex root / lead（当前集成者） | 本轮已创建的 src/、server/、scripts/、public/、根构建配置、README、docs/PRODUCT-PLAN.md、API-CONTRACT.md、COSTS.md、RESEARCH-AND-TOOLS.md、design/、本轮research审计、collaboration任务/决定/状态/给lead请求的回复 | 实现代理已交还文件所有权，root收尾集成与验收 |
| source_audit（本轮后端代理） | server/、API-CONTRACT.md、README | 已实现和审查，所有权交还root，11项测试通过 |
| fitness_recipes_audit（本轮页面代理） | Nutrition、Training、Sleep、Reports | 已交还root，编译通过，root完成主流程验收 |
| native_architecture（本轮计划代理） | Onboarding、Plan、Trends、PRODUCT-PLAN.md | 已交还root，编译与双语键验证通过 |
| 本机独立 Claude Code | 自己的 docs/reviews 与本次请求；后续 rules/qa候选 | 已收到并读取真实共享文件评审；未向它假装派发新实现任务 |

外部新建的 docs/predevelopment、handoff、agent-prompts、AGENTS.md、.agents/.claude Skills 等保持其原所有者；root不整体覆盖或删除。接下来重新分工必须先更新本表，不让两个工作会话同时改同一产品文件。

## 任务

| ID | owner | 状态 | 依赖 / 路径 | 验收 |
|---|---|---|---|---|
| M0-01 | root＋研究代理 | done | research/、Cal AI官方文字、Apple文档 | 固定仓库SHA与许可、已验证/未验证界限 |
| M0-02 | root | done | design/、Image Gen | 完整桌面、移动与饮食审核概念，独立资产 |
| M0-03 | 后端代理→root | done | server/ | 账户隔离、上传、持久化、版本、CSRF、跨标签身份，11项测试 |
| M0-04 | 页面代理→root | done | src/features/ | 真实记录、份量、训练、睡眠、报告人工校正；未接AI明确显示 |
| M0-05 | 计划代理→root | done | 引导、计划、趋势 | 确认、接受、拒绝、补偿撤销；无缺失填零 |
| M0-06 | root | done | 完整网页、3001构建后服务 | IAB完整主流程与导出/退出；1440/390及原概念1505×1045截图原尺寸复查，无页面溢出；构建后控制台零错误，重启持久化核对通过 |
| M0-07 | root | done | 当前请求与ADR-M0 | 接受Claude评审的真实架构边界，更新阶段冲突 |
| M1-01 | backend / rules候选，尚未派发 | todo | ADR-M0、预算/地区/认证供应商确认 | 实体资源API、增量同步、服务端规则与营养聚合、独立身份；公开邀请前必做 |
| M1-02 | root / Claude qa候选，尚未派发 | todo | 真实服务配置与明确授权 | AI/OCR真实调用、失败/费用/健康数据同意测试 |
| I1-01 | SwiftUI角色候选，尚未派发 | todo | Mac连接、Apple会员/签名确认 | HealthKit原生真机与TestFlight，不能用Web替代 |

M1不是已经完成的后台任务，未创建自动化或偷偷启用账单。当前本机网站有真实功能，但并非完整AI/双端MVP。
