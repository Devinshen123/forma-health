# Claude Code食物识图架构brief评审

2026-10-14。使用已安装的真实Claude Code CLI，安全无工具模式、无会话持久化，仅传入 [设计brief](ai-photo-review-brief.md)。成功返回JSON，is_error=false。这不是源代码评审，也未向它发送用户照片、健康资料或密钥。原始返回在忽略的collaboration/claude-ai-photo-response.json；以下为lead对建议的处理。

- 接受项目全局预留额：只有每账户限额可被创建/删除多账号绕过。默认全局US$2/UTC日，独立无身份聚合账本，同一事务检查两级预算；删除账户不退已消耗额。
- 接受照片同意凭证：draft存服务端acceptedAt、food-photo-v1和语言；UI不把store:false解释为供应商零保留。
- 在途租约与超时：实现已有AbortController、覆盖响应体读取的timer、最多两次尝试，晚返回只在失效Promise中解析，不自动保存；要求Sharp处理也有时间上限，SQL锁使用requestId避免旧finally移除新锁。
- 媒体边界：实现已设20MP限制、format核验、拒绝动画、最大5MiB，并重新编码去EXIF。原图保持私有本机附件以支持原图审核，JSON导出不含图片bytes，因此建议提及“原图EXIF进入导出”不适用于实际导出。原图仍可含位置，应继续按本机私有数据保护；此轮不改变全部附件管线。
- 删除语义：Meal删除后最后一个引用消失，既有state保存清理附件；新增draft随附件删除级联。未确认草稿在取消时删除临时附件/草稿，不把AI结果自动保存为饮食事实。

这些增量通过正式请求发给backend和qa，待测试结果证明；未启用真实供应商账单。
