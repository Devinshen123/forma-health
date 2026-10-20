import type { AppState } from '../src/types';
import type { CompanionQuest } from '../src/companion';
import { localDateOf } from './rules/days';

export interface CompanionFact { quest: CompanionQuest; kind: 'meal' | 'workout' | 'sleep' | 'rest'; id: string; externalId?: string }
export const companionDay = (now: Date) => now.toISOString().slice(0, 10);
export function companionLocalDay(state: AppState, now: Date): string {
  return localDateOf(now, state.profile?.timezone ?? 'UTC');
}

/** Recording quests only: no thresholds for calories, load, exercise or sleep length. */
export function companionRecords(state: AppState): CompanionFact[] {
  return [
    ...state.meals.map(meal => ({ quest: 'nutrition' as const, kind: 'meal' as const, id: meal.id })),
    ...state.workouts.map(workout => ({ quest: 'movement' as const, kind: 'workout' as const, id: workout.id, externalId: workout.importFingerprint })),
    ...state.sleeps.map(sleep => ({ quest: 'sleep' as const, kind: 'sleep' as const, id: sleep.id })),
  ];
}
export function companionFacts(state: AppState, now: Date): CompanionFact[] {
  if (!state.profile) return [];
  const day = companionLocalDay(state, now), facts: CompanionFact[] = [];
  for (const meal of state.meals) if (meal.date === day)
    facts.push({ quest: 'nutrition', kind: 'meal', id: meal.id });
  // Only saved history is eligible. An active workout or a checked Today action is not completion.
  for (const workout of state.workouts) if (workout.date === day)
    facts.push({ quest: 'movement', kind: 'workout', id: workout.id, externalId: workout.importFingerprint });
  for (const sleep of state.sleeps) {
    const start = Date.parse(sleep.start), end = Date.parse(sleep.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 86400000 && end <= now.getTime()
      && localDateOf(new Date(end), state.profile.timezone) === day)
      facts.push({ quest: 'sleep', kind: 'sleep', id: sleep.id });
  }
  return facts;
}
