# AUTH-INTEGRATE · 邮箱与快捷登录契约

2026-10-24，01 lead。用户明确选择邮箱密码、Google及Apple快捷登录，授权实现。任务板AUTH-SERVER/WEB/QA/INTEGRATE是本切片唯一所有权表。

新增`src/auth.ts`、`/api/auth/options`、`/api/auth/account`、邮件验证/恢复/密码与provider start/complete路由，现有User与register/login响应保持兼容，详见[方案](../../architecture/authentication-20261024.md)。客户端只经已有request发送请求，私有请求仍携带固定account hint。注册/登录可传AbortSignal；Modal仅新增可选closeDisabled。

继续用SQLite与Strict HttpOnly会话；不迁移Supabase、不新增身份依赖。Apple form_post采用回同源后再验证浏览器绑定的两阶段完成；provider subject唯一映射，不按同邮箱静默合并。旧密码账户不会因缺邮件配置锁出。邮件或快捷登录配置缺失显式报告，合成验证与真实供应商开通分开记载。reset/verify token不能通过GET消费，不进入持久浏览器存储或导出。

受影响：后端技术助手实现服务与账本、前端技术助手实现入口与安全页、独立QA审查重放/绑定/验签及账户隔离，root集成App/api/Settings和最终验证。iPhone原生第三方快捷登录不在本轮Web契约实现中。
