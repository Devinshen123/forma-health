// Appearance derives from saved level; previewing never mutates the reward ledger.
export const COMPANION_GROWTH_STAGES = [
  { level: 1, zh: '初见', en: 'First hello', detailZh: '圆滚滚的小伙伴，陪你开始。', detailEn: 'A little friend for your first steps.' },
  { level: 3, zh: '萌芽', en: 'Budding', detailZh: '长出一对小叶翼，开始探索。', detailEn: 'Little leaf wings, ready to explore.' },
  { level: 5, zh: '闪耀', en: 'Glowing', detailZh: '叶翼变大，身边亮起成长星星。', detailEn: 'Bigger wings and your own little stars.' },
  { level: 10, zh: '绽放', en: 'Blooming', detailZh: '花瓣环绕，留下属于你的成长光环。', detailEn: 'Petals and a halo to celebrate your journey.' },
] as const;

export function companionGrowthStage(level: number) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return COMPANION_GROWTH_STAGES.reduce((stage, candidate, index) => safeLevel >= candidate.level ? index : stage, 0);
}
