import entries from './opengym.json';
import type { CatalogExercise } from '../types';

export const openGymExercises: CatalogExercise[] = entries.map(item => ({
  ...item,
  id: `opengym-${item.sourceId}`,
  source: 'opengym',
  level: 'unspecified',
  instructions: [],
  instructionUrl: `/exercise-content/opengym/${Number(item.sourceId) % 64}.json`,
  video: {
    src: `/exercise-media/opengym/clip/${item.sourceId}.mp4`,
    poster: `/exercise-media/opengym/still/${item.sourceId}.webp`,
    credit: '© Aliaksandr Makatserchyk / Gym visual',
  },
}));
