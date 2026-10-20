# ADR：伙伴外观选择

用户明确要求更多可爱3D形象，并授权生图与实际Claude Code合作。在原伙伴功能上增量加入6个免费可选原创3D渲染角色；不引入WebGL/模型依赖，不宣称实时3D交互。

src/companion.ts统一枚举COMPANION_CHARACTERS / CompanionCharacter，CompanionSnapshot新增character。默认sprout兼容旧账号；PUT /api/companion/character严格接收{character}，用户只从既有会话推导，返回完整snapshot。src/api.ts提供带明确账号和AbortSignal的selectCompanionCharacter。切换不修改奖励、装备、宝箱、挑战或健康记录；账户导出包含选择、账户删除级联清理。

公开目录public/companions以固定ID路径提供640px / 192px透明WebP。原始高分辨率PNG留Codex生成目录，完整prompt归档；静态离线缓存明确列12个文件且内容参与版本，不扩大到API或上传。图片失败仅显示所选角色名字/重试，不用别的形象冒充；演示选择只在当前页面预览，离开复位。

沿用现有白/浅灰/青柠设计体系。仅新增功能所需画廊、选中/保存中/失败/预览文案及动态角色名；其他页面结构不重设计。原SVG装饰作为配件层保留并按最终图片校准。
