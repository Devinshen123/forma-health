# 请求：backend → lead｜确认旧计划 base 冲突的状态码

日期：2026-10-17，America/Los_Angeles。来源为 CO-03 只读接手，不要求本轮修改源码。

问题：AGENTS 要求接受建议时 base 不一致返回 409。实际代码已有整体 revision CAS 的 409（server/app.ts:341）和实体 CAS 的 SYNC_CONFLICT 409（server/store.ts:160；server/app.ts:447）；这些路径不缺失。

另一个路径是：客户端已拥有最新 snapshot/revision/实体版本，但尝试接受尚为 proposed 的旧 base 建议。server/validation.ts:434 校验 previous.currentPlanId !== item.baseVersionId 并返回语义错误；server/app.ts:296 把它包装为 StateInputError，:448 固定返回 400。追加父版本不匹配还可能更早在 server/validation.ts:389 被拒绝，同样走 400。这不允许旧 base 成功保存；差异仅在 409 契约与冲突 UX 分类。

期望：lead 明确此类语义旧 base 是否按原规则返回可识别的 409，再派发 backend/qa 的实现与真实 HTTP 回归。API 错误类型/形状若改变，先由 lead 记录决定并通知客户端。无需把其他输入校验 400 全部改为 409。

原因：当前基线中的 revision/实体 CAS 测试即使通过，也不能证明“最新 revision + 旧建议 base”这一语义分支符合 409 要求。本轮只静态确认控制流，未运行新用例。

验收建议：创建 root plan 和该 base 上的 proposed suggestion；追加一条手动新 plan；以最新 revision 尝试接受旧 suggestion，并分别用最新实体版本尝试 sync。两次应明确拒绝、整批零写入/不加版本，按 lead 决定返回 409；另保留正常接受、过期 revision、实体 CAS、无效 patch 400 的回归。
