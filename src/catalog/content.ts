export interface ExerciseContent {
  id: string;
  description: string;
  descriptionZh?: string;
  instructions: string[];
  instructionsZh?: string[];
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 30 && value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 2000);
}

/** An unavailable or mismatched content file never becomes another exercise's instructions. */
export function parseExerciseContent(bucket: unknown, sourceId: string): ExerciseContent {
  if (!bucket || typeof bucket !== 'object' || !('schemaVersion' in bucket) || bucket.schemaVersion !== 1 || !('exercises' in bucket) || !bucket.exercises || typeof bucket.exercises !== 'object' || !Object.hasOwn(bucket.exercises, sourceId)) throw Error('Invalid exercise content');
  const entry = (bucket.exercises as Record<string, unknown>)[sourceId];
  if (!entry || typeof entry !== 'object' || !('id' in entry) || entry.id !== sourceId || !('description' in entry) || typeof entry.description !== 'string' || entry.description.length > 4000 || !('instructions' in entry) || !strings(entry.instructions)) throw Error('Invalid exercise instructions');
  if ('descriptionZh' in entry && (typeof entry.descriptionZh !== 'string' || entry.descriptionZh.length > 4000)) throw Error('Invalid translated description');
  if ('instructionsZh' in entry && !strings(entry.instructionsZh)) throw Error('Invalid translated instructions');
  return {
    id: sourceId,
    description: entry.description,
    instructions: entry.instructions,
    ...('descriptionZh' in entry ? { descriptionZh: entry.descriptionZh as string } : {}),
    ...('instructionsZh' in entry ? { instructionsZh: entry.instructionsZh as string[] } : {}),
  };
}
