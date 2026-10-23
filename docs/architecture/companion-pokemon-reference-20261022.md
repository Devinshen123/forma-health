# 伙伴造型参考与头像生成

2026-10-22，用户要求以宝可梦形象重做伙伴，并保留胖嘟嘟的造型、实时3D与成长功能。

数据库中的 sprout / bunny / otter / cloud / bear / seal ID 保持不变，对应显示为妙蛙种子 / 皮卡丘 / 杰尼龟 / 胖丁 / 卡比兽 / 伊布，原账户经验、外观、宝箱和挑战不需要迁移。

参考官方图鉴：[妙蛙种子](https://www.pokemon.com/us/pokedex/bulbasaur)、[皮卡丘](https://www.pokemon.com/us/pokedex/pikachu)、[杰尼龟](https://www.pokemon.com/us/pokedex/squirtle)、[胖丁](https://www.pokemon.com/us/pokedex/jigglypuff)、[卡比兽](https://www.pokemon.com/us/pokedex/snorlax)、[伊布](https://www.pokemon.com/us/pokedex/eevee)。名称与角色设计属于各自权利人；这些是用户要求的参考造型，不能沿用此前“Forma原创角色”的描述。

立体几何由 `src/components/companion-scene.ts` 创建，不下载第三方模型或贴图。头像与主场景使用同一工厂、灯光与取景逻辑。

运行 `node scripts/companion-portrait-studio.mjs`，在本机5191端口选择角色并导出640×640透明PNG；使用sharp编码为对应WebP，再缩放192×192缩略图。生成的12份图像位于 `public/companions/`。该工具仅为本机制作素材而启动，不接入正式服务或读取账户资料。

头像使用版本查询参数绕过旧活动离线缓存；新离线缓存将此公开素材请求映射至同版本的静态头像。私有API与附件缓存规则不变。
