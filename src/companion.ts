// Shared game contracts. XP is game progress, never a health score.
export const COMPANION_RULE_VERSION = 1;
export const COMPANION_CHARACTERS = ['sprout', 'bunny', 'otter', 'cloud', 'bear', 'seal'] as const;
export type CompanionCharacter = typeof COMPANION_CHARACTERS[number];
export const COMPANION_CHARACTER_DETAILS = {
  sprout: { zh: '妙蛙种子', en: 'Bulbasaur', descriptionZh: '背着小种子，一点点长大。', descriptionEn: 'Little steps, with a little seed.', color: '#e8f3e9' },
  bunny: { zh: '皮卡丘', en: 'Pikachu', descriptionZh: '电力满满，也记得休息。', descriptionEn: 'Full of sparks. Make time to rest, too.', color: '#fcf4d9' },
  otter: { zh: '杰尼龟', en: 'Squirtle', descriptionZh: '不着急，按自己的节奏前进。', descriptionEn: 'Take it easy, at your own pace.', color: '#e8f3f7' },
  cloud: { zh: '胖丁', en: 'Jigglypuff', descriptionZh: '软乎乎地，陪你过好每一天。', descriptionEn: 'A soft little friend for every day.', color: '#faeaf0' },
  bear: { zh: '卡比兽', en: 'Snorlax', descriptionZh: '慢慢来，睡饱再出发。', descriptionEn: 'Rest well. Your next step can wait.', color: '#e8eff0' },
  seal: { zh: '伊布', en: 'Eevee', descriptionZh: '每一种成长，都有自己的可爱。', descriptionEn: 'Every way of growing has its own charm.', color: '#f5ecdf' },
} satisfies Record<CompanionCharacter, { zh: string; en: string; descriptionZh: string; descriptionEn: string; color: string }>;
export const COMPANION_ITEMS = ['leaf', 'cap', 'star', 'scarf', 'flower', 'crown'] as const;
export type CompanionItem = typeof COMPANION_ITEMS[number];
export type CompanionQuest = 'nutrition' | 'movement' | 'sleep';
export interface CompanionChest { id: string; milestone: number; item: CompanionItem | null; openedAt: string | null }
export interface CompanionChallenge {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  participants: { self: boolean; days: number }[];
}
export interface CompanionSnapshot {
  ruleVersion: number;
  character: CompanionCharacter;
  day: string; // UTC reward day, fixed across time-zone changes.
  xp: number;
  level: number;
  activeDays: number;
  equipped: CompanionItem | null;
  inventory: CompanionItem[];
  quests: { id: CompanionQuest; completed: boolean; xp: number }[];
  chests: CompanionChest[];
  challenge: CompanionChallenge | null;
}
export const companionLevel = (xp: number) => 1 + Math.floor(xp / 100);
export function demoCompanion(): CompanionSnapshot {
  return {
    ruleVersion: 1, character: 'sprout', day: new Date().toISOString().slice(0, 10), xp: 140, level: 2, activeDays: 6,
    equipped: 'leaf', inventory: ['leaf'],
    quests: [{ id: 'nutrition', completed: true, xp: 10 }, { id: 'movement', completed: false, xp: 10 }, { id: 'sleep', completed: true, xp: 10 }],
    chests: [{ id: 'demo-3', milestone: 3, item: 'leaf', openedAt: '2026-10-18T00:00:00Z' }, { id: 'demo-6', milestone: 6, item: null, openedAt: null }], challenge: null,
  };
}
