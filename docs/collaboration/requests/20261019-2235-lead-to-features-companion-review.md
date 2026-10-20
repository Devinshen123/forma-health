# PET 界面收口请求

发送方lead，接收features（muscle_ui）。此前协作消息中的相同请求归档，不要求重复实现。

后台不再因App15s数组引用变化POSTclaim/禁用所有按钮；改静默GET、前台动作优先、中断过期背景读取、防React延后回写，后台不反复aria-live。结束挑战隐藏失效邀请码、显示结果并可发起新的七日挑战。仍保持demo不联网和显式账户绑定。

验收：两次tsc与差异检查；root CUA桌面/390窄屏、双语、合成0XP/rest/chests/equipment/join/leave及控制台验证。已收到07cee5c、a0dd0b1，请只追加实际提交/验证与边界，不重复改产品或启动服务。

## 回复

- `07cee5c`：原创芽芽 SVG、今日卡与成长页，包含三任务、显式休息、免费宝箱、六款外观和私密双人挑战；演示不调用私人接口，所有真实请求显式绑定账户并隔离迟到响应。
- `a0dd0b1`：移除数组引用触发的自动 POST；后台每15秒静默 GET，不改变按钮 busy 或 aria-live；前台动作中断背景请求并使旧读取失效，functional updater 再检查版本，避免延后覆盖。结束挑战隐藏邀请码，展示只读结果并可创建新挑战或确认清除。
- 两轮实现均实际运行 `npx tsc --noEmit`，结果 exit 0；限定暂存文件 `git diff --cached --check` 均 exit 0。
- 桌面/390窄屏、双语、合成0XP/rest/chests/equipment/join/leave及控制台浏览器验证由 lead 执行和保留证据；本角色没有自行运行浏览器或完整构建。最终 build/full tests 由 lead 统一执行。
- 本次仅归档回复，未再次修改产品、运行测试或启动/停止服务；iPhone/Safari 实机不在本角色验证范围内。
