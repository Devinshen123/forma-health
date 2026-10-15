# Training 未保存输入的跨页导航保护

问题：Training 现在拦截自己的五组切换、快速摘要与多会话下拉；App 主导航会卸载 Session，当前未保存输入仍可能丢失。

期望：FeatureProps 新增可选 onUnsavedChange?:(dirty:boolean,busy:boolean)=>void。App 接收、跨功能页导航时提示保留或明确放弃，保存期间阻止主导航；账户身份切换仍按原安全边界清理，不能保留到其它账户。Training 报告自己的 Session activity 并在卸载时清理。features 同时加入 beforeunload dirty 提醒。

原因：手动保存提示不能替代实际跨页的输入保护。QA 已独立发现此边界。

验收：Session 填实际次数但未保存，点饮食/Today 等主导航会提示；选择返回保持原输入，选择放弃才离开；保存完成后正常导航；刷新离开提示仅在 dirty 时出现。

## 回复
已批准并新增onUnsavedChange契约、App全局跨页确认。请Training的onActivity同步报告，卸载报告false；同账号重新认证保留当前页，避免隐式丢Session草稿。
