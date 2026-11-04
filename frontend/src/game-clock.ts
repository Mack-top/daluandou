import { createDefaultSave, localDateKey, rolloverDailyState, type GameSave } from './game-data';

export function localDate(now = new Date()): string {
  return localDateKey(now);
}

export function createFreshSave(now = new Date()): GameSave {
  return createDefaultSave(now);
}

export function rolloverDaily(save: GameSave, now = new Date()): GameSave {
  return rolloverDailyState(save, localDate(now));
}