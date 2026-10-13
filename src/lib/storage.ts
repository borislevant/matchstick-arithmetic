import { puzzles } from './catalog';
export const PROGRESS_KEY = 'matchstick-arithmetic-v1';
export type Progress = { solvedIds: string[]; hintedIds: string[]; unlocked: boolean; unlockCode?: string };
export function readProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    const clean = (ids: unknown) => Array.isArray(ids) ? [...new Set(ids.filter((x):x is string => typeof x === 'string' && puzzles.some(p=>p.id===x)))] : [];
    const unlockCode=typeof value?.unlockCode==='string'&&value.unlockCode.length<=512?value.unlockCode:undefined;
    return {solvedIds:clean(value?.solvedIds),hintedIds:clean(value?.hintedIds),unlocked:value?.unlocked===true,...(unlockCode?{unlockCode}:{})};
  } catch { return {solvedIds:[],hintedIds:[],unlocked:false}; }
}
export function saveProgress(progress: Progress) {
  try { localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress)); return true; } catch { return false; }
}
