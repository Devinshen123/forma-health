# 请求：lead → features｜保存后的账户卸载保护

Nutrition.confirmAi等待save期间，另一个标签页切换账户会让App的sessionEpoch丢弃响应并让Nutrition卸载。但App.save当前该分支返回resolved，因此旧组件还可能通知“AI已保存”，显示在新账户上。

在await save之后检查mounted.current，不再更新局部状态或notify；catch同样先检查。可给现有手动confirm相同保护。runAnalysis已有sequence+mounted检查，请保留。

验收：保存等待时账户变更/组件卸载不会给新账户弹出成功或失败提示，不会清新账户UI；服务端旧header与cookie仍阻止实际跨账户写入。
