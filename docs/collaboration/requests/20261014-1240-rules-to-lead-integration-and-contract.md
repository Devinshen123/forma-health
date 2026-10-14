# 请求：rules → lead（抄送 backend）｜规则层可接入，需要的契约扩展

- 时间：2026-10-14 12:40 PDT
- 发起：rules（Claude Code）

## 已交付（只在 rules 路径内）

- `server/rules/`：`types`、`nutrition`、`days`、`plan`、`safety`、`messages`、`engine`，入口是 `index.ts`。全部是纯函数。
- `docs/rules/README.md`：规则目录、门槛和接口说明。
- `docs/safety/safety-rules.md`：安全规则草案，待营养师审核。

## 验证（2026-10-14 12:3x PDT 实际运行）

| 命令 | 结果 |
|---|---|
| `node --import tsx --test server/rules/*.test.ts` | 42/42 通过 |
| `npx tsc --noEmit`（全项目） | 退出码 0 |
| `npm test`（现有测试，未包含 rules） | 57/57 通过 |

## 请求 lead

1. **测试脚本**：把 `server/rules/*.test.ts` 加进 `package.json` 的 `test` 脚本。
2. **契约扩展**（`src/types.ts`），全部为可选字段，与现有数据向后兼容：
   ```ts
   export interface EvidenceRef { kind: "meal" | "workout" | "sleep" | "plan"; id: string; date: string }
   export interface Suggestion {
     // …现有字段不变；reason 继续存理由 key，例如 "rule.training.minutes_down"
     ruleId?: string;
     engineVersion?: number;
     reasonParams?: Record<string, string | number>;
     evidence?: EvidenceRef[];
     completeness?: { loggedDays: number; totalDays: number } | null;
   }
   export interface Profile {
     // …现有字段不变
     birthYear?: number | null;      // 18 岁门槛（用户 Q2 已确认）
     bodyWeightKg?: number | null;    // 以后计算蛋白质区间用，可选
     safetyFlags?: Partial<Record<
       "pregnancy_or_breastfeeding" | "eating_disorder_history" | "kidney_disease" | "diabetes_medication" | "under_medical_care",
       boolean>>;                     // 保守模式
   }
   ```
   扩展之前，`toSuggestion()` 已能输出现有结构，但证据和参数会丢失，界面也就无法展示“为什么”。
3. **用规则替换写死的内容**（Dashboard 的三条固定行动、Plan 页的固定 30 分钟建议）。建议由 backend 新增一个只读接口：
   - `GET /api/today?date=YYYY-MM-DD`：在服务端调用 `evaluate()`，返回 `{ actions, proposals }`。
   - 前端用 `renderReason(reason, lang)` 渲染，或者 lead 把 `messages.ts` 的模板同步到 `src/i18n/`。
   - 提议写入时由服务端创建 `Suggestion`，客户端不能再自己生成建议。

## 给 backend 的接入点（M1-01）

| 场景 | 使用 |
|---|---|
| 接受建议 | `checkBase()`，不一致返回 409；然后 `applyPatch()` |
| 撤销 | `compensate()`，只能撤销当前版本，撤销会新建恢复版本 |
| 饮食汇总 | `mealNutrients()`、`sumNutrients()`、`dailyNutrition()`，未知值保持 null，有 partial 标记 |
| 睡眠统计 | `sleepNights()`：按醒来日期归档，重叠合并，并返回被拒绝的记录 |
| 问卷 | `ageEligibility()`、`conservativeMode()` |
| 照片草稿审核 | `macroEnergyConsistency()` 提示数值不一致；`allergenWarnings()` 只提示可能冲突 |

规则层抛出 `PlanRuleError`，`code` 取 `no_change | out_of_bounds | stale_base | unknown_version | no_parent`。backend 可以直接映射成 HTTP 状态码。

## 需要用户或专业人员决定

- 热量下限、减重速度上限、蛋白质区间：需要营养师审核。在此之前，引擎不自动改动任何营养目标。

## 验收方式

lead 在文末追加 `## 回复`。
