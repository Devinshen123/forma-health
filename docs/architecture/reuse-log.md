# 第三方代码复用记录

## FUD-01 / FUD-02｜Fud AI 拍照识别适配

- 日期：2026-10-22（America/Los_Angeles）；批准人：本聊天现有01 lead。用户明确批准最新版Prompt，首先实施Fud拍照识别。
- 上游：https://github.com/apoorvdarshan/fud-ai
- 固定 commit：6fa160239727a6ab275d0ff302acd191160fce20（本轮GitHub核实）。许可：MIT，Copyright (c) 2026 Apoorv Darshan。完整许可随服务端源码与 public/licenses/fud-ai-MIT.txt 分发。
- 来源：ios/calorietracker/Services/GeminiService.swift 中照片分析提示词、analyzeFood、parseFoodAnalysis 的整份/ingredients输出思想；ios/calorietracker/Models/IngredientPortion.swift 的食材克重与按比例营养计算；ios/calorietracker/Views/FoodResultView.swift 的修改后Log流程。
- 目标：server/fud-ai-food-photo.ts、server/food-photo.ts；src/features/foodPhotoReview.ts、src/features/Nutrition.tsx。
- 适配：Swift/Kotlin转TypeScript；只采用拍照营养草稿逻辑，不复用原生组件、素材、订阅/托管Worker或整套App。模型仍由Forma Express服务端调用OpenAI，供应商和Fud分析引擎分开标注。用户稍后配置密钥，不使用作者服务或凭证。
- 安全差异：严格Zod/StructuredOutputs；缺重量不设1g、缺营养不设0；只有有实际重量和营养的食材才换算per100g。整份和食材不重复累加，未知与估算来源保留。原有账户隔离、私有图片重编码、超时/重试、日限额与预算预留不变。
- 不复制SparkyFitness代码/schema/UI；它只提供产品功能对照。
- 状态：适配完成，整套345/345测试、完整构建与CUA合成审核保存验证通过；实际3001已运行Fud引擎。用户选择稍后配置真实模型密钥，照片准确率未验证。