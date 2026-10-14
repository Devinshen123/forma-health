# SparkyFitness、Mealie 源码与食谱规划研究

研究日期：2026-10-13（America/Los_Angeles）。用途：开发前选型；未实现产品、未安装项目依赖、未启动服务、未接入任何用户健康数据。

## 结论与建议

针对面向全球用户、以健身表现和长期健康为核心、未来收费的产品，建议自主建立核心账户、健康事件、趋势分析与 AI 交互；把两个仓库作为架构和领域研究材料。当前不能将 SparkyFitness 当作可无条件复制的商业底座。Mealie 可以成为食谱管理或用户自托管集成的评估对象，但 AGPL 义务必须按实际组合、修改、分发及网络服务方式逐项审查。用 API 或单独容器连接，不会自动消除许可证义务。

食谱领域可另行评估直接使用上游 MIT 库 recipe-scrapers、ingredient-parser，而不是复制 Mealie 的包装服务。若自动营养配餐是差异化核心，还可评估 Eat This Much 官方 Partner API 的合同与经济性。以上均为待评估路径，不代表已获取授权或已集成。

## 快照与证据方法

本次使用 agent-reach 的 GitHub CLI 路由读取官方仓库、Release、Actions 和许可文件，使用其 Jina Reader 路由读取官方网页，并通过 web browse 交叉核实。保留两个 shallow clone，未执行仓库脚本；两个参考 checkout 的 git status 均为空。

| 项目 | 检查的分支/完整 SHA | 提交时间 UTC | 最新 Release（与检查的 HEAD 区分） | 本地快照 |
| --- | --- | --- | --- | --- |
| SparkyFitness | main / 30d40b75013ff727fd78a4a3f0705a3c46a8e5e3 | 2026-10-13 22:46:05 | v1.8.0，2026-10-08；tag SHA 28d32d8536877d765ad03ca3727409c679b847a7 | C:/Users/devin/健康网站/reference-sources/SparkyFitness |
| Mealie | mealie-next / 0272569540119f2236ee3803e7444a96331cbda8 | 2026-10-13 21:43:12 | v3.28.0，2026-09-24；tag SHA 0552eaa4a80031b8572849cca0ed95d07f1be001 | C:/Users/devin/健康网站/reference-sources/mealie |

查询时两个仓库均未归档。SparkyFitness 的默认分支和 package version 1.8.0、Mealie 的默认分支和 package version 3.28.0，并不表示 HEAD 与最新 Release tag 的源码完全相同。依赖版本以下均来自检查的 HEAD。

证据：[SparkyFitness 检查的提交](https://github.com/CodeWithCJ/SparkyFitness/commit/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3)、[v1.8.0 Release](https://github.com/CodeWithCJ/SparkyFitness/releases/tag/v1.8.0)、[Mealie 检查的提交](https://github.com/mealie-recipes/mealie/commit/0272569540119f2236ee3803e7444a96331cbda8)、[v3.28.0 Release](https://github.com/mealie-recipes/mealie/releases/tag/v3.28.0)。

## 许可与商业闭源兼容性

### SparkyFitness

根 LICENSE 是作者自定义非商业条款。允许非商业使用、复制、修改和分发；商业优势或金钱报酬相关的直接或间接使用要求作者事先书面许可。衍生作品沿用非商业条款，除非作者书面同意。分发需保留版权与完整许可证；还包含贡献权益转让、违约终止条款。README 明确称为 source-available，而非 open source。

SparkyFitnessServer/package.json 的 license 字段仍为 ISC，与根 LICENSE 存在元数据不一致。不能用该单一字段推导整个服务可按 ISC 商用。本研究没有找到针对商业闭源应用的单独授权文件，也没有联系作者；是否能授权、价格、覆盖版本、贡献权利及素材范围均未知。

对本产品的工程决策：在书面商业许可范围明确前，不把该仓库的代码、SQL migrations、UI、图片或 shared 包并入产品；前期免费获客也不应自行视为等同非商业目的。这是基于许可证文本采取的选型建议，不是确定性法律结论。

证据：[固定 SHA 的根 LICENSE](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/LICENSE)、[Server package.json](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessServer/package.json)、[README](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/README.md)、[项目 FAQ](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/docs/src/faq.md)。

### Mealie

根 LICENSE 为 GNU AGPL v3，pyproject.toml 声明 AGPL-3.0-only。AGPL 并非禁止收费；其复制、修改、分发和源码提供要求需要履行。第 13 条特别规定：修改后的程序如果供用户通过网络交互，须显著提供获得该版本 Corresponding Source 的机会。哪些部分属于受覆盖作品、组合程序或独立作品，要按实际技术边界判断。

对本产品的工程决策：不能把 Mealie 源码或其独有实现直接放入闭源核心，再仅以“走 REST API”声称豁免。可以在确定修改范围、部署/分发方式、源码提供与 notices 方案后，评估独立服务或用户自托管集成；是否符合闭源商业目标仍需具体许可审查。食谱文本、图片和导入网站内容的权利也不由程序 AGPL 自动授予。

证据：[固定 SHA 的 LICENSE，特别是第 5、6、13 条](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/LICENSE)、[pyproject.toml](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/pyproject.toml)。

### 上游库与依赖边界

Mealie 直接依赖 recipe-scrapers 15.12.0、ingredient-parser-nlp 2.8.0。分别核查官方上游仓库：recipe-scrapers main SHA 958eb630d10bf1b2ccf36b656727663eeaa7a0da、ingredient-parser master SHA 8cac34971564b01f1992fe5ff0cff36d01ed96c6，其根许可证均为 MIT。MIT 文本允许商业使用等行为并要求保留版权和许可告示。这只证明所查上游 SHA 的根许可；不等于已经审计上述 release 的发布包、模型/训练数据、每个传递依赖或被抓取网页内容。

更适合后续验证的路径：从上游直接安装所选精确版本，独立编写适配、验证与数据标准化；留存许可证、版本、数据来源和允许用途。不要把“上游是 MIT”推导成 Mealie 对同一模块增加的代码也受 MIT 许可。

证据：[recipe-scrapers 固定 LICENSE](https://github.com/hhursev/recipe-scrapers/blob/958eb630d10bf1b2ccf36b656727663eeaa7a0da/LICENSE)、[ingredient-parser 固定 LICENSE](https://github.com/strangetom/ingredient-parser/blob/8cac34971564b01f1992fe5ff0cff36d01ed96c6/LICENSE)。

## SparkyFitness：源码核查

### 结构与依赖

这是 pnpm monorepo，根 packageManager 是 pnpm 10.33.4，包含 shared、Web、Server、Mobile 和 Garmin Python 微服务。

| 模块 | 核实的技术与声明版本 | 证据路径（相对参考快照） |
| --- | --- | --- |
| Web | React ^19.3.0、Vite ^8.3.0、TypeScript ^6.0.3、Tailwind 4.3.3、TanStack Query、Radix、Recharts | SparkyFitnessFrontend/package.json |
| Server | Express ^5.2.1、pg ^8.23.0、Better Auth ^1.7.4、Zod ^4.6.1、AI SDK ^7.0.99，以及 Anthropic/Google/OpenAI provider | SparkyFitnessServer/package.json |
| Mobile | Expo ~57.0.25、React Native 0.86.3、React 19.2.3、@kingstinct/react-native-healthkit ^15.1.0、Health Connect、Skia、Reanimated；存在 expo-glass-effect | SparkyFitnessMobile/package.json |
| shared | TS 类型、Zod 数据库及 API schemas、单位与营养数学工具 | shared/package.json、shared/src/ |
| 数据库/部署 | PostgreSQL 18.3-alpine；Compose 使用 server + Web 镜像；Garmin 服务段默认注释 | docker/docker-compose.prod.yml |
| Garmin | FastAPI 0.111.0、uvicorn 0.30.1、python-garminconnect git tag 0.3.5 | SparkyFitnessGarmin/requirements.txt |

版本仅为 manifest 声明，并未在本机解析/安装/验证兼容性。pnpm-lock.yaml 存在，但没有完成全量传递依赖 SBOM 与第三方许可证分析。上述原有第三方 SDK、数据库内容、运动图片与 provider 的数据/服务条款仍需各自核查。

证据：[Web manifest](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessFrontend/package.json)、[Mobile manifest](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessMobile/package.json)、[Compose](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/docker/docker-compose.prod.yml)。

### 数据结构与值得学习的模式

| 已核实事实 | 对我们设计的启发 | 实证路径/行 |
| --- | --- | --- |
| foods 与 food_variants 分离；variant 有 serving_size/unit、数值 nutrients、manual/ai_estimate/imported 来源及 high/medium/low AI confidence | 食物身份、份量和营养数据依据要分层；估算数据必须可辨认 | shared/src/schemas/database/FoodVariants.zod.ts:12、43 |
| food_entries 保存 food/variant 外键，同时保存名称、份量和 nutrients；foodEntrySnapshot 工具明确在记录时生成营养快照 | 修改食物库不能悄悄重写用户历史日志；趋势应使用日志当时的值 | shared/src/schemas/database/FoodEntries.zod.ts:16；SparkyFitnessServer/utils/foodEntrySnapshot.ts:5 |
| FoodPhotoEstimate contract 区分 portion 与 per-100g，保存估算重量、confidence、assumptions 和 provider match；匹配替换是明确的用户选择 | 拍照识别应产生可编辑草稿，显式核对重量与匹配依据，避免单位混淆和静默替换 | shared/src/schemas/api/FoodPhotoEstimate.api.zod.ts:35、54、114；shared/src/utils/foodPhotoEstimateMath.ts:63、168、180 |
| exercise_entries 包含 duration、energy、source/source_id、心率、配速、功率等；另有 exercise_entry_sets、laps、HR zones 和 GPS 子表 | 健身表现不能仅用消耗热量概括；有氧、力量与遥测需要不同事件模型 | shared/src/schemas/database/ExerciseEntries.zod.ts:5；db_schema_backup.sql:1981、2115、2130、2148、2180 |
| sleep_entries 有 bedtime、wake_time、duration、stage totals、source、时区与 UTC offset；daily_health_metrics 按用户、日期及 source_provider 存聚合 | 原始事件时间、记录时区、设备/来源及每日摘要需保留；跨时区/跨午夜不能仅用本地日期字符串 | shared/src/schemas/database/SleepEntries.zod.ts:13；shared/src/schemas/database/DailyHealthMetrics.zod.ts:5；db_schema_backup.sql:2822 |
| sleepRepository 使用 user_id/entry_date/source 冲突更新；measurementRepository 对同步水分样本使用 user_id/source/source_id 幂等 upsert | 同步需要外部 ID 与来源标记；也要独立验证不同设备之间的去重规则 | SparkyFitnessServer/models/sleepRepository.ts:130；SparkyFitnessServer/models/measurementRepository.ts:1773、1970 |
| RLS 文件启用 PostgreSQL 行级安全、使用 app.user_id/authenticated_user_id 与细粒度 family_access | 用户与家庭权限应可在数据层表达；有 RLS 文件本身不证明系统已通过安全验证 | SparkyFitnessServer/db/rls_policies.sql:124、129、182 |

这些是领域和工程模式研究；建议以我们自己的业务规则独立设计，未复制上述实现或 schemas。

### 已存在的集成与限制

HealthKit 源码包含 queryQuantitySamples、queryCategorySamples、queryWorkoutSamples、统计读取、sleep/workout 变换及 background delivery 模块；docs/healthkit.md 记录原始 workout 到服务器事件的映射。仓库有对应 tests。只能确认实现存在，本次没有 iPhone、Apple Health 权限与真实数据验证，不能声称所有类型均正确同步。

SparkyFitness 已有 Mealie adapter，读取 /api/recipes 与 /api/recipes/{slug}，Bearer token、分页、recipeServings 和 Nutrition mapping 均可见。adapter 用 parseFloat 读取营养字符串，提示我们需要独立处理单位、每份/每食谱基准和缺失值；不能将该处理当作经过验证的全球营养规范。源码也有 Wger、free-exercise-db provider 和运动素材加载，相关数据许可需要单独调查。

证据：[HealthKit index](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessMobile/src/services/healthkit/index.ts)、[Mealie adapter](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessServer/integrations/mealie/mealieService.ts)、[exercise provider service](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/SparkyFitnessServer/services/exerciseService.ts)。

### 维护与验证边界

最近三次 Release 为 v1.8.0（10-08）、v1.7.3（09-28）、v1.7.2（09-21），当前 HEAD 于研究当日提交，属于活跃项目。CI 定义包括 Web、Mobile、Server、Garmin 及 migration 相关检查；仓库存在 food photo、HealthKit、sleep 和 RLS 测试。观察到 main 的 CI Tests run 38479666624 成功，但其 SHA 是 5b6329afaa8ee0cc771c5c40d002a8051a7c5e62，不能当作本次 HEAD 全部通过的证据。

本次未运行 pnpm install、validate、test、migration 或 Docker；未验证 AI 准确率、HealthKit 端到端、跨源去重、科学有效性、Apple 登录或多租户生产安全。README 将 AI、family access 和 API docs 标为 beta，并提醒 breaking changes。适合做研究对照，不能以功能存在等同交付成熟。

证据：[CI 定义](https://github.com/CodeWithCJ/SparkyFitness/blob/30d40b75013ff727fd78a4a3f0705a3c46a8e5e3/.github/workflows/ci-tests.yml)、[观察到的成功 run](https://github.com/CodeWithCJ/SparkyFitness/actions/runs/38479666624)。

## Mealie：源码核查

### 结构与依赖

Python FastAPI 后端 + Nuxt/Vue/Vuetify Web 前端，具有 recipe CRUD、import workflow、meal calendar、shopping lists、groups/households、REST/OpenAPI、备份和迁移。

| 模块 | 核实的声明版本/能力 | 证据路径 |
| --- | --- | --- |
| 后端 | Python >=3.14,<3.15；FastAPI 0.143.0、SQLAlchemy 2.0.54、Pydantic 2.14.0、Alembic 1.20.0 | pyproject.toml |
| 食谱导入/AI | recipe-scrapers 15.12.0、ingredient-parser-nlp 2.8.0、extruct、OpenAI SDK 3.26.1 | pyproject.toml；mealie/services/scraper/；mealie/services/recipe/import_workflow/ |
| Web | Nuxt ^4.4.6、Vue ^3.5.35、Vuetify ^4.1.2、pnpm 11.23.0、Vitest | frontend/package.json |
| 存储 | SQLite 和 PostgreSQL；SQLAlchemy 模型、Alembic migrations；uv.lock、frontend/pnpm-lock.yaml | mealie/db/models/；mealie/alembic/；uv.lock |

官方文档建议多并发、网络存储等场景使用 PostgreSQL；这些安装建议不代表其已经适配全球商业多租户运营。未核查原生 iPhone App；本次证据显示其核心客户端为 Web/PWA，iOS Shortcut 也不是原生 App。[官方文档](https://mealie.io/)、[backend manifest](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/pyproject.toml)、[frontend manifest](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/frontend/package.json)。

### 数据与业务边界

| 已核实事实 | 复用/学习价值 | 实证路径/行 |
| --- | --- | --- |
| RecipeSummary 有 user/household/group、servings/yield、prep/total time、tags/categories/tools、orgURL；Recipe 附 ingredients、instructions、nutrition | 食谱是可追溯的内容对象；家庭/共享边界与个人摄入日志应分开 | mealie/schema/recipe/recipe.py:170、243 |
| Nutrition 的 calories、protein/carbohydrate/fat 等为 str 或 None，并允许数字转字符串 | 不可直接作为严格数值营养数据库；需要单位、数值、份量基准、来源和缺失状态规范化 | mealie/schema/recipe/recipe_nutrition.py:7 |
| RecipeIngredient 有 quantity、unit、food、note、original_text；unit 可有 standard_quantity/standard_unit；存在替代食材 | 保留原文并映射结构化食材/单位，允许用户修正；食材替换不应自动保证营养等价 | mealie/schema/recipe/recipe_ingredient.py:269、312、451 |
| Meal plan entry 包含 date、entry_type、recipe_id、recipe_scale 或 title/text；types 含 breakfast/lunch/dinner/snack 等 | 计划条目、实际食用日志和食谱本身是三个对象；份量倍数需显式存储 | mealie/schema/meal_plan/new_meal.py:20、33；mealie/db/models/household/mealplan.py:62 |
| random meal route 依据日期/餐型 rules 组合过滤，再 order_by=random 选食谱 | 已实现规则辅助选择；没有在所查路径找到卡路里/宏量营养目标优化器，不能宣传为 ETM 型自动配餐引擎 | mealie/routes/households/controller_mealplan.py:54、69、134 |
| ShoppingListService 在 food identity、可转换单位及 checked 状态允许时合并；保存 recipe refs 与 scales | 购物清单应能追溯哪道菜贡献了需求量，份量变化可重算；不能跨不兼容单位随意相加 | mealie/services/household_services/shopping_lists.py:47、75；mealie/schema/household/group_shopping_list.py:58、106 |
| 食谱导入使用多策略，recipe-scrapers scrape_html、extruct 等，并有 safehttp fetch | 结构化网页导入与 AI 解析可组成回退流程；用户确认、访问边界和原网页内容许可须独立处理 | mealie/services/scraper/recipe_scraper.py:46；mealie/services/scraper/scraper_strategies.py:303、501 |

代码复用优先级建议：学习“来源原文 → 结构化配料 → 份量缩放 → 周计划 → 可追溯购物清单”流程；优先独立编写营养规范化与计划/日志转换；直接复用 Mealie 源码仅在许可方案确认后考虑。它不是饮食+运动+睡眠+长期趋势核心模型的替代品。

### 维护与运行边界

最近三次 Release 为 v3.28.0（09-24）、v3.27.0（09-17）、v3.26.0（09-14），当前 HEAD 于研究当日提交。后端 CI 有 SQLite/PostgreSQL matrix，Python 3.14、锁文件核对、Ruff、后端测试；前端有 Vitest，e2e 有 Playwright，另有 CodeQL 与 container scan workflows。观察到 PR CI run 38491505620 成功，但它对应另一个 SHA 5a519517006da3b55041071c9c6340ced9f3a83a，不证明本次 HEAD 或本机安装通过。

本次未 uv sync、未运行 pytest/Vitest/Playwright、未构建 Docker、未执行数据库迁移，也未导入真实食谱或验证 OpenAPI。可运行性的准确表述是：项目提供安装文档、锁文件、Compose/Docker 和测试流程，具有可执行验证路径；本次只静态核查与查看上游 CI，尚未本机运行验证。

证据：[backend CI](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/.github/workflows/test-backend.yml)、[e2e workflow](https://github.com/mealie-recipes/mealie/blob/0272569540119f2236ee3803e7444a96331cbda8/.github/workflows/e2e.yml)、[观察到的成功 run](https://github.com/mealie-recipes/mealie/actions/runs/38491505620)。

## Eat This Much：官方功能与范围启发

以下是官方网页声明，未登录或实测其 App。

| 官方可核实功能 | 对产品范围的启发 | 来源 |
| --- | --- | --- |
| 按 food preferences、budget、schedule 生成计划；支持 calorie/macros、diet styles、周计划与自动 shopping list | “营养目标”之外还要保存时间、预算与饮食偏好；计划结果应可执行 | [首页](https://www.eatthismuch.com/) |
| 不同日期 nutrition targets、ingredient exclusions、recurring foods、替换/重新生成、pantry 优先、recipe collections | 健身训练日与休息日需要可变目标；用户可锁定熟悉餐食再局部调整，而不是每次重建整周 | [Pricing/功能页](https://www.eatthismuch.com/pricing) |
| 专业版可为客户设目标、复用计划、给计划/购物单，客户权限可控制；其 Collaborate 仍用 ETM 网站与 App | 教练协作可作为后续独立范围；这类 co-branding 不等于拥有独立品牌 iPhone App | [Professionals](https://www.eatthismuch.com/professionals) |
| Partner API 声明可生成周/日/单餐，返回 JSON、聚合购物清单、PDF/HTML、7000+ curated recipes 与饮食/排除过滤 | 可以评估商业采购计划引擎与授权食谱服务，核心健康事件和趋势仍由我们维护 | [Partner API](https://www.eatthismuch.com/partner-api) |

Partner API 页面明确处于 early access，暂不 self-serve，定价按合作用途与量协商、签合同后开通；标准条款声明营养数据可缓存最多 7 天，其余数据留存限合作期。没有公开可用于计算本产品 US$20/月收费毛利的固定 API 单价。国际食谱覆盖、语言、单位、过敏原可靠性、端到端延迟、数据留存/退出迁移和商业授权范围均需评估。[官方 API 条款摘要与流程](https://www.eatthismuch.com/partner-api)。

建议首轮确认的最小计划领域：偏好/排除与目标 → 食谱及营养依据 → 日/周计划 → 每餐可改份量/换菜 → 实际摄入记录 → 清单/剩余食材。不要把全部教练、多客户管理、pantry、外卖/电商集成纳入第一版。训练表现与长期健康的跨域建议应在数据完整度、证据和可解释性建立后逐步扩展；仓库和产品营销没有证明此类建议的科学效果。

## 后续开发前需要完成的核查

1. 选定自主实现/许可采购/第三方服务路径，留存许可证版本、允许用途和用户数据权利；如选 SparkyFitness，获取明确书面商业许可。
2. 对实际选用版本执行发布包与传递依赖许可/SBOM 核查；运动图片、食谱图片/文本和 provider 数据许可逐项记录。
3. 只针对选定模块做隔离的运行验证：营养单位/份量与缺失值、导入解析、购物清单缩放、同步幂等、时区/跨午夜及权限。
4. 单独验证原生 iPhone 权限、设备后台同步、Apple 登录、App 发布与部署。两个仓库的存在不代表这些交付条件已完成。
5. 若采购 ETM API，先取得合同、评估权限、成本与数据退出方案；本次没有联系供应商、付费、注册或调用业务 API。

agent-reach check-update 已运行：当前 v1.5.0，为最新版本。

