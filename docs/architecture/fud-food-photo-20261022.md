# Fud AI 拍照识别与后续健康平台接入

日期：2026-10-22（America/Los_Angeles）。用户批准最新版Prompt，先实现照片识别审核保存，健康平台分步接入。

## 第一切片：Fud AI 拍照识别

采用MIT许可的Fud AI上游提交6fa160239727a6ab275d0ff302acd191160fce20，适配实际整份/食材识别提示与解析、份量比例审核流程。详见reuse-log.md及public/licenses/fud-ai-MIT.txt。

外部模型仍由Forma后端请求OpenAI Responses API，固定现有模型和已有预算/超时/私有图片保护。模型输出改成Fud整份/ingredients结构，严格检查后确定性转换为现有FoodPhotoItem的每100g营养基准，对外API与旧饮食记录保持兼容。只采用食材列表或整份其中一条，不重复相加；无法确定重量时保留未知，用户补全后才允许保存。

capabilities.foodPhoto与新FoodPhotoDraft可返回analysisEngine:{id:'fud-ai',sourceCommit:'6fa160239727a6ab275d0ff302acd191160fce20'}。provider仍是openai；这是实际实现来源与模型供应商两个不同概念。旧存档没有metadata仍可读取。

审核页面可修改名称、克重、份数及每100g营养；一份基准清楚可见，半份/一份/两份快捷操作不二次缩放营养。修改使审核确认失效，确认保存前不产生饮食事实，已有批次ID和冲突处理防重复保存。

用户已明确选择稍后配置OPENAI_API_KEY。缺配置时页面继续允许手动录入并显示真实状态；所有本轮AI返回值测试使用注入的合成HTTP夹具，不证明真实照片识别准确率。

## 后续切片（不冒充已接通）

优先新增项是华为健康、小米运动健康、Keep；保留Apple Health、Google Health、WHOOP、Oura。方案依据是用户已审核的Prompt，本地原件在主项目.forma-local/deliverables/sparky-forma-integrations-20261022/。

1. 统一来源/同步状态与最小必要数据契约，按来源稳定ID幂等导入、游标确认、删除、单位与时区处理，跨云API/手机桥接去重。明确不同来源的数据用途限制。
2. 华为：核实Health Kit/Health Service Kit云通道与地区/开发者资质，申请实际scopes。小米：开通小米账号和运动健康云服务，权限审批后接官方OAuth与数据API。申请资格不由一个连接按钮代替。
3. Apple Health：已有Forma iPhone工程的HealthKit只读桥接，经用户单独同意上传到Forma。Keep优先经“Keep写入Apple Health → Forma iPhone读取 → Forma网页”接入，逐字段/设备版本实测。纯网页不能直接读HealthKit。
4. Google Health：云API与Android Health Connect分开；WHOOP/Oura按官方OAuth、权限与审核条件接入，先有凭证的平台先联调。Android原生条件另核，不能用Google云连接假称已覆盖所有Health Connect本机记录。
5. 在可靠数据进入后完善趋势和行动；原始记录、AI估算与用户确认记录分离，供应商分数不自动变为Forma健康分，不自动更改训练/饮食目标。

开发者应用注册、健康数据权限审批、实际OAuth凭证、真机签名与可达HTTPS服务仍是后续真实联调前置。不得读取/提交.env、索要聊天内密钥、默认上传真实健康记录或创建付费资源。