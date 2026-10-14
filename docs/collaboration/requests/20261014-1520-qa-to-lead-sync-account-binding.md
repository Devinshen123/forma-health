# 账户固定绑定与离线队列验收

Owner：qa → lead。T-04 只读同步审查，未修改 src/api/App/sync。

## 问题与期望

SyncEngine.performFlush 先 await getMe，然后调用使用全局动态 accountHint 的 syncMutation/getSync。getMe 开始时的账户与后续请求头可能在等待中改变。请每个 engine 发出的请求显式固定 this.user.id，并在 await 后检查 stopped；不可把 A 的待同步数据重绑定到 B 的有效会话。

backend 已另行报告 App 对401/resetSession/跨标签消息 stop(true) 会删除未上传队列、同账户两个标签 writeCached 会用完整队列互相覆盖、无限等待 fetch 使队列 busy 卡住、resolve 在 persist 失败前改 conflict/queue。请在源实现修复后通知 qa，用真实 engine 与独立 transport/临时账户检查，不用生产用户数据。

## 验收

- 延迟 /auth/me 响应，在等待时切换动态 accountHint；A engine 的后续请求仍固定 A，服务端拒绝 cookie B，绝不保存到 B。
- 网络响应丢失后稳定 mutationId 重试幂等；重连/认证失败不丢本机待同步记录。
- 两个同账户 engine 对共享 IndexedDB 队列不能静默覆盖彼此。
- 冲突审核只对明确审核的实体重基，其他 queued entity 保持 CAS；写盘失败后还可再次审核/重试。
- 明确退出/删除清理自己的私有缓存。

## qa 验证更新

2026-10-14：lead 固定 engine snapshot/写请求的 expectedAccount、设置请求超时并保留认证失败队列；backend 接手 storage，提供原子 requireEmpty/generation/settled/顺序合并。实际13项client测试通过（含真实临时SQLite与公共IDB fixture），新训练相关39项和全仓155项通过。没有以删测试/放宽预期通过。原生浏览器 IndexedDB由lead最终验证。
