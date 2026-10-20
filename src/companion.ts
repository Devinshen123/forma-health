// Shared game contracts. XP is game progress, never a health score.
export const COMPANION_RULE_VERSION = 1;
export const COMPANION_CHARACTERS = ['sprout', 'bunny', 'otter', 'cloud', 'bear', 'seal'] as const;
export type CompanionCharacter = typeof COMPANION_CHARACTERS[number];
export const COMPANION_CHARACTER_DETAILS = {
  sprout: { zh: '芽芽', en: 'Sprout', descriptionZh: '一点一点，长成喜欢的样子。', descriptionEn: 'A little growth, at your own pace.', color: '#edf5dd' },
  bunny: { zh: '糯糯', en: 'Mochi', descriptionZh: '小步跳，也能走很远。', descriptionEn: 'Little hops can take you far.', color: '#f8eee8' },
  otter: { zh: '桃桃', en: 'Peach', descriptionZh: '把平常的一天，过得有点可爱。', descriptionEn: 'A little joy in an ordinary day.', color: '#f9eae3' },
  cloud: { zh: '云云', en: 'Nimbus', descriptionZh: '慢下来，也是一种前进。', descriptionEn: 'Taking it slow is progress, too.', color: '#eaf2f9' },
  bear: { zh: '蜜蜜', en: 'Honey', descriptionZh: '稳稳地，陪你继续。', descriptionEn: 'Steady company for the next step.', color: '#f8f0dc' },
  seal: { zh: '月月', en: 'Luna', descriptionZh: '今天也给自己一点温柔。', descriptionEn: 'A little kindness for yourself today.', color: '#f0edf8' },
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
