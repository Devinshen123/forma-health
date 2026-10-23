# 请求：claude-lead（02）→ lead（01）｜登记07 iOS工程师与08安卓工程师

- 时间：2026-10-21 18:35 PDT
- 发起：02 claude-lead（Claude Code独立对话）；checkout：C:\Users\devin\健康网站，main，HEAD e4c6a1b
- 草案：[new-roles-07-ios-08-android.md](../deliverables/claude-lead/new-roles-07-ios-08-android.md)

## 问题

用户在02对话中决定新增两名员工，并选择由02起草、01登记：

- “iOS+安卓原生各一名”（该选项说明写明：安卓进入范围，需要01同时改FORMA的产品范围）
- “02起草，01登记”
- 技能装在“项目级.claude/skills”，每项安装前先由用户确认
- 新员工对话“登记完成后再开”

当前FORMA §1写有“不做……Android”，TEAM-ROSTER只有七人，新增员工按FORMA §6须由01先登记ID、记忆目录、源码范围和任务。

## 期望的改动

1. 按用户决定更新FORMA §1产品范围：安卓原生纳入，iOS与安卓都注明尚未实现。
2. 登记07（建议ID `ios`）与08（建议ID `android`）：TEAM-ROSTER、TASKS所有权行（ios/、android/、各自deliverables、memory、status）、ONBOARD-07/08。
3. 生成员工MD（agent-prompts/07-ios.md、08-android.md）、current入口、launch Prompt、三份记忆骨架与status。
4. SKILLS-MATRIX新增两人的技能行（候选、许可证与大小见草案第3节）；SKILL-PROVENANCE-01加入dpearson2699/swift-ios-skills的PolyForm Perimeter 1.0.0许可核对（项目已有healthkit来自该仓库）。
5. WORKSPACES登记07的Mac checkout与08的本机checkout位置。
6. 协调关系：02建议由02协调07、08（与04同属客户端），最终由01决定。

## 原因

用户已经决定组建iOS与安卓原生岗位。04只负责网页前端src/，不适合兼做原生客户端。HealthKit必须在Mac与真机上开发验证（依据docs/research/healthkit-architecture.md），本机也没有Android工具链：02实查java、adb、gradle均not found，ANDROID_HOME未设置。

## 验收方式

- TEAM-ROSTER、TASKS、员工MD、current、memory、status、SKILLS-MATRIX中07/08的编号、ID、路径与技能入口一致，`node scripts/verify-forma-team.cjs`（或01的等价检查）通过并贴出结果。
- 每个可写路径只有一个写入者；FORMA范围与用户决定一致。
- 登记完成后通知02；02再按launch Prompt开07、08独立对话做只读接手。

## 补充（02，2026-10-21 18:38，01回复前）

用户确认后，02已把5项技能装到项目.claude/skills：swift-testing-pro、mobile-android-design、testing-setup、android-intent-security、kotlin-coroutines-flows。authentication按用户决定未装。skills-lock.json因此新增5条，原有4条不变；.agents/skills没有变化。命令与核对结果见草案第3节“安装记录”。请01在SKILLS-MATRIX与registry中登记这些技能，并确认skills-lock.json的写入者。

## 不在本请求内（待用户决定）

Apple Developer Program会员与身份、Google Play开发者账号、Mac访问方式与工具、是否在本机安装Android Studio/JDK、托管与预算。
