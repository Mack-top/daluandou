/**
 * v12（排行榜）+ v13（运营与安全日志）验证：
 * battle_wins 榜在结算事务内 upsert、power 榜随阵容变更、RANK 并列同名次、
 * 赛季快照 + 断点续发、append-only 日志写入。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, countRows, execute, queryAll, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { startBattle, settleBattle } from '../src/services/battle.service.js';
import { setFormation } from '../src/services/roster.service.js';
import { claimStarterChests } from '../src/services/roster.service.js';
import {
  getLeaderboardView,
  getPlayerRank,
  snapshotLeaderboard,
  distributeSeasonRewards,
  updateLeaderboardScore,
} from '../src/services/leaderboard.service.js';
import { insertOpLog, insertSecurityLog } from '../src/repositories/log.repository.js';
import { listSnapshots } from '../src/repositories/leaderboard.repository.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-leaderboard-logs-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

function newPlayer(nickname: string): string {
  const { player } = createGuest({ nickname, gender: 'female' });
  claimStarterChests(player.id);
  setFormation(player.id, ['青团']);
  return player.id;
}

test('battle_wins 榜：结算胜利后自动 upsert（事务内，无客户端上报端点）', () => {
  const playerId = newPlayer('胜场旅人');
  const battle = startBattle(playerId, '1-1');
  settleBattle(playerId, battle.id);

  const entry = queryOne<{ score: number }>(
    "SELECT score FROM leaderboard_entries WHERE leaderboard_id = 'lb-battle-wins' AND player_id = ?",
    playerId,
  );
  assert.equal(Number(entry?.score), 1);
  assert.equal(getPlayerRank('lb-battle-wins', playerId), 1);

  const second = startBattle(playerId, '1-1');
  settleBattle(playerId, second.id);
  const again = queryOne<{ score: number }>(
    "SELECT score FROM leaderboard_entries WHERE leaderboard_id = 'lb-battle-wins' AND player_id = ?",
    playerId,
  );
  assert.equal(Number(again?.score), 2, '同一玩家同榜一行，score 覆盖更新');
});

test('power 榜：阵容变更事务内重算 upsert', () => {
  const playerId = newPlayer('战力旅人');
  const entry = queryOne<{ score: number }>(
    "SELECT score FROM leaderboard_entries WHERE leaderboard_id = 'lb-power' AND player_id = ?",
    playerId,
  );
  assert.ok(Number(entry?.score) > 0, 'setFormation 后 power 榜应有分数');
});

test('RANK 口径：并列同分同名次（1,1,3）', () => {
  const a = newPlayer('并列甲');
  const b = newPlayer('并列乙');
  const c = newPlayer('并列丙');
  updateLeaderboardScore('lb-worldtree', a, 5);
  updateLeaderboardScore('lb-worldtree', b, 5);
  updateLeaderboardScore('lb-worldtree', c, 3);

  const view = getLeaderboardView('lb-worldtree', 10);
  const ranks = view.entries.map(entry => Number(entry.rank));
  assert.deepEqual(ranks, [1, 1, 3]);
});

test('赛季快照 + 断点续发：rewarded 标记防重复发奖，奖励经系统邮件下发', () => {
  const a = newPlayer('赛季甲');
  const b = newPlayer('赛季乙');
  updateLeaderboardScore('lb-chronicle', a, 100);
  updateLeaderboardScore('lb-chronicle', b, 50);

  const { snapshotted } = snapshotLeaderboard('lb-chronicle', 'TEST-S1');
  assert.ok(snapshotted >= 2);
  assert.throws(
    () => snapshotLeaderboard('lb-chronicle', 'TEST-S1'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
    '同赛季重复结算拒绝',
  );

  const { distributed } = distributeSeasonRewards('lb-chronicle', 'TEST-S1', [
    { upTo: 1, rewards: [{ kind: 'gem', amount: 50, label: '灵晶' }] },
  ]);
  assert.equal(distributed, 1, '只有第 1 名命中奖励档');

  const rewarded = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM leaderboard_snapshots WHERE leaderboard_id = 'lb-chronicle' AND season_key = 'TEST-S1' AND rewarded = 1",
  );
  assert.equal(Number(rewarded?.total), 1);

  // 断点续发：已发奖的不再重复发放
  const again = distributeSeasonRewards('lb-chronicle', 'TEST-S1', [
    { upTo: 1, rewards: [{ kind: 'gem', amount: 50, label: '灵晶' }] },
  ]);
  assert.equal(again.distributed, 0);

  const mails = queryAll<{ title: string }>(
    "SELECT title FROM player_system_mails WHERE source = 'system' AND title = '赛季结算奖励'",
  );
  assert.equal(mails.length, 1);
  assert.equal(listSnapshots('lb-chronicle', 'TEST-S1').length, snapshotted);
});

test('榜单分数只能为非负整数；未知榜单 404', () => {
  const playerId = newPlayer('边界旅人');
  assert.throws(() => updateLeaderboardScore('lb-battle-wins', playerId, -1));
  assert.throws(
    () => updateLeaderboardScore('lb-ghost', playerId, 1),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  );
});

test('v13 日志：op_logs / security_logs append-only 且可按事件检索', () => {
  insertOpLog({ playerId: null, action: 'test_action', detail: { probe: 1 }, ip: '127.0.0.1' });
  insertSecurityLog({ playerId: null, event: 'csrf_fail', detail: { probe: 1 }, ip: '127.0.0.1' });
  insertSecurityLog({ playerId: null, event: 'rate_limited', detail: {}, ip: '' });

  const op = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM op_logs WHERE action = 'test_action'");
  assert.equal(Number(op?.total), 1);
  const security = queryAll<{ event: string }>(
    "SELECT event FROM security_logs WHERE event IN ('csrf_fail', 'rate_limited')",
  );
  assert.equal(security.length >= 2, true);

  // 日志失败不拖垮业务：非法事件被 CHECK 拦截，但 insertSecurityLog 吞掉异常
  assert.doesNotThrow(() =>
    insertSecurityLog({ playerId: null, event: 'not_a_valid_event' as never, detail: {} }),
  );
  // 直接写库时 CHECK 约束仍然生效（防线在库层）
  assert.throws(() =>
    execute("INSERT INTO security_logs (id, player_id, event, detail_json, ip, created_at) VALUES ('log-x', NULL, 'bogus', '{}', '', '2026-01-01')"),
  );
});
