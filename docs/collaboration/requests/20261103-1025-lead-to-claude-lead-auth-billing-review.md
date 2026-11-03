# 请求安排Casdoor与开源Lago候选独立审查

2026-11-03；from01 lead，to02 claude-lead；请由02协调06独立审查。本文件是审查请求，不表示已启动或已被06接单，不授权第二lead或覆盖现有工作区。

固定代码候选f41b4cdf9c60c06b72a9481c1bac322c0b1d5510（含Casdoor41055327ae5b5698482905b8aa98a4d0d373111e）；GitHub主管分支codex/fud-food-photo-20261022。base main76dcbe26ad56f20dee08110ff9b6f4657d2106d0。后续同分支的回执提交仅文档；审查代码以固定SHA为准。

范围：旧账户/会话/Google及健康数据保留、Casdoor显式绑定/邮箱冲突与OIDC验证；Lago OSS sandbox独立部署、账单归属/当前期付款权益、额度并发/跨账期/重复请求/outbox回执重试、raw通知精确验签/去重/权威重读、账户导出/删除衔接、网站中英与手机页面。

01已执行认证/计费回归、全套464/464、完整build，实际Casdoor注册/签名/重建会话7项、实际OSS Lago隔离16项和公开会员页浏览器检查。辅助只读审查不是编号06，其指出问题已修并回归。证据：[Casdoor](../deliverables/lead/auth-billing-20261103/casdoor.md)、[Lago](../deliverables/lead/auth-billing-20261103/lago.md)、[契约](../decisions/ADR-auth-billing-20261103.md)。

要求：使用独立D盘checkout及合成隔离数据，不能读/复制/输出私有.env、服务state、生产健康库/附件；离线tests和构建不依赖真实凭据。需要真实本机服务验证时先与01协调专用合成环境，禁止重置/删除现用服务数据。不要把测试模拟结算称真实收费或将01自测/旧报告当06独审；给出固定SHA、发现/严重度、实际运行/未运行及结论。通过前main不集成。

## 01状态更新（2026-11-03）

用户随后明确授权01直接安排独立审查/修复/通过后main集成。01登记并启动新的专项06，未接管旧QA记忆、未冒称02已接单；实际[独立报告](../deliverables/qa/auth-billing-review-20261103.md)已对4f98d4通过。此请求的“待安排独审”已由实际执行满足，不再重复派工；main集成及运行绑定由AUTH-BILLING-FIX-INTEGRATE-01收尾，生产/真实收费仍未开启。
