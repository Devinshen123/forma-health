// Shared game contracts. XP is game progress, never a health score.
export const COMPANION_RULE_VERSION = 1;
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
    ruleVersion: 1, day: new Date().toISOString().slice(0, 10), xp: 140, level: 2, activeDays: 6,
    equipped: 'leaf', inventory: ['leaf'],
    quests: [{ id: 'nutrition', completed: true, xp: 10 }, { id: 'movement', completed: false, xp: 10 }, { id: 'sleep', completed: true, xp: 10 }],
    chests: [{ id: 'demo-3', milestone: 3, item: 'leaf', openedAt: '2026-10-18T00:00:00Z' }, { id: 'demo-6', milestone: 6, item: null, openedAt: null }], challenge: null,
  };
}
