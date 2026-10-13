// The first 12 easy/medium IDs in the Session 3 catalog, in catalog order.
// Keep this list explicit: reordering cards must not silently change free access.
export const FREE_PUZZLE_IDS: readonly string[] = [
  'spark-01',    // 1+1=3
  'spark-02-v2', // 7-1=9
  'spark-03',    // 4+5=6
  'spark-04',    // 3+3=8
  'spark-05',    // 8-3=3
  'spark-06',    // 6-1=6
  'spark-07',    // 7+7=0
  'spark-08',    // 6+1=5
  'spark-09',    // 5+1=4
  'ember-02',   // 0+3=5
  'ember-01',   // 9+3=6
  'spark-10',   // 8-3=6
];
export const canPlay = (id: string, unlocked: boolean) => unlocked || FREE_PUZZLE_IDS.includes(id);
