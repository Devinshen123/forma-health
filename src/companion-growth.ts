import type { CompanionCharacter } from './companion';

export interface CompanionForm { dex: number; level: number; zh: string; en: string }
// Forma progression thresholds, not the original games' item/friendship requirements.
// Stable family IDs keep existing accounts, XP and wardrobes intact.
export const COMPANION_EVOLUTIONS: Record<CompanionCharacter, readonly CompanionForm[]> = {
  sprout: [{ dex: 1, level: 1, zh: '妙蛙种子', en: 'Bulbasaur' }, { dex: 2, level: 3, zh: '妙蛙草', en: 'Ivysaur' }, { dex: 3, level: 5, zh: '妙蛙花', en: 'Venusaur' }],
  bunny: [{ dex: 25, level: 1, zh: '皮卡丘', en: 'Pikachu' }, { dex: 26, level: 3, zh: '雷丘', en: 'Raichu' }],
  otter: [{ dex: 7, level: 1, zh: '杰尼龟', en: 'Squirtle' }, { dex: 8, level: 3, zh: '卡咪龟', en: 'Wartortle' }, { dex: 9, level: 5, zh: '水箭龟', en: 'Blastoise' }],
  cloud: [{ dex: 39, level: 1, zh: '胖丁', en: 'Jigglypuff' }, { dex: 40, level: 3, zh: '胖可丁', en: 'Wigglytuff' }],
  bear: [{ dex: 446, level: 1, zh: '小卡比兽', en: 'Munchlax' }, { dex: 143, level: 3, zh: '卡比兽', en: 'Snorlax' }],
  seal: [{ dex: 133, level: 1, zh: '伊布', en: 'Eevee' }, { dex: 136, level: 3, zh: '火伊布', en: 'Flareon' }],
};
export const COMPANION_ART_VERSION = '?v=evolution-20261022';
export function companionGrowthStage(level: number, character: CompanionCharacter = 'sprout') {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return COMPANION_EVOLUTIONS[character].reduce((stage, form, index) => safeLevel >= form.level ? index : stage, 0);
}
export function companionForm(character: CompanionCharacter, level: number): CompanionForm {
  return COMPANION_EVOLUTIONS[character][companionGrowthStage(level, character)];
}
export function companionPortrait(character: CompanionCharacter, level: number, thumbnail = false) {
  return `/companions/forms/${companionForm(character, level).dex}${thumbnail ? '-thumb' : ''}.webp`;
}
export function nextCompanionEvolution(character: CompanionCharacter, xp: number) {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const level = 1 + Math.floor(safeXp / 100);
  const next = COMPANION_EVOLUTIONS[character][companionGrowthStage(level, character) + 1];
  return next ? { ...next, remainingXp: Math.max(0, (next.level - 1) * 100 - safeXp) } : null;
}
