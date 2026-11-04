import type { Reward } from './game-data';

export type BattleSide = 'ally' | 'enemy';
export type Combatant = {
  id: string;
  name: string;
  side: BattleSide;
  character: string | null;
  star: number;
  maxHp: number;
  attack: number;
  speed: number;
  defense?: number;
  critical?: number;
  resistance?: number;
};

export type BattleTurn = {
  round: number;
  actor: string;
  target: string;
  kind: 'attack' | 'skill' | 'heal';
  skill: string;
  amount: number;
  critical: boolean;
  health: Record<string, number>;
};

export type BattleRecord = {
  version: 1;
  id: string;
  seed: number;
  stageId: string;
  stageName: string;
  chapter: string;
  startedAt: string;
  settledAt: string | null;
  power: number;
  enemyPower: number;
  units: Combatant[];
  turns: BattleTurn[];
  win: boolean;
  rounds: number;
  firstClear: boolean;
  rewards: Reward[];
  status: 'pending' | 'claimed' | 'lost';
};