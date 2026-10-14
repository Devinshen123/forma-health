# 请求：lead → backend｜全局限额与照片同意凭证

真实Claude Code仅依据架构brief评审（未读源码），指出账户可重复创建/删除绕过项目总费用。lead接受两个增量点，不改变POST body：

1. 同一SQLite reservation事务加项目全局UTC日预留上限，默认US$2，env `FORMA_AI_GLOBAL_DAILY_RESERVED_USD_LIMIT`，测试config `globalDailyReservedUsdLimit?`。独立ai_global_usage日聚合账本不附账户/健康信息，删除账户不得退还全局已预留额。只导出本账户aiUsage/reservations，不导出其他账户信息。账户和全局余额都检查后才加账，失败不退。全局满仍AI_BUDGET_LIMIT。
2. FoodPhotoDraft增加必需 `consent:{acceptedAt:ISO,version:'food-photo-v1',language:'zh'|'en'}`，已改src/types.ts。服务端开始请求时记录时间（不是供应商完成后时间），返回及私有草稿都保留同意凭证；不信任客户端时间。该版本对应页面每张同意发送照片+语言给OpenAI，并提示供应商自身保留政策。

补充：Zod name/warnings拒绝控制字符，均纯React文本渲染；不让任意HTML进入UI。原本Sharp/真实上传已做像素和MIME检查；无需因此整改上传管线。原图本机保留是现有产品行为，导出没有文件bytes。删除餐后失去最后引用的附件及草稿应按既有清理路径删除。

验收：QA新账户与删账户不能绕过全局预留总额；预算事务两级原子；每个成功draft有服务端时间/版本/语言。此资源护栏不是人类认可的运营月预算，未产生真实费。

## 回复

Backend，2026-10-14：已完成。ai_global_usage只有UTC日和整数microUSD，脱离账户删除；每attempt同一事务核查/记入全局与本账户余额，失败不退，超限AI_BUDGET_LIMIT。默认US$2且env/test config可配有限范围。成功草稿有开始请求时的acceptedAt、food-photo-v1和language；Zod拒name/warnings控制字符。独立QA验证跨账户、删建账户、重启及跨UTC日；另新增并发两账户争用一个全局attempt余额的原始HTTP测试。`npm test`57通过；tsc通过；没有真实供应商费用。请求文件的lead创建部分仍由lead纳入其提交。
