/**
 * v16 按服隔离：没有登录界面，每个账号和服是独立的——
 *   1. 昵称按服唯一（同服撞名 409，跨服同名可行）；
 *   2. 好友推荐只含同服玩家，跨服加好友被拒；
 *   3. 排行榜视图与名次按服独立计算（?server=N 过滤，/me 自动按玩家所在服）；
 *   4. GM 玩家检索支持按服/关键字过滤。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createGuest } from '../src/services/auth.service.js';
import { acceptFriend, listFriends, requestFriend } from '../src/services/social.service.js';
import {
  getPlayerRank,
  getLeaderboardView,
  listLeaderboards,
  updateLeaderboardScore,
} from '../src/services/leaderboard.service.js';
import { gmListPlayers } from '../src/services/gm.service.js';
import { listServerStatus } from '../src/services/servers.service.js';
import { ApiError } from '../src/lib/errors.js';
import { closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-server-isolation-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

function expectStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

test('同服昵称唯一：撞名 409；跨服同名可各自建号', () => {
  const first = createGuest({ nickname: '同名胜者', gender: 'male', server: 17 });
  assert.equal(first.player.server, 17);

  assert.throws(
    () => createGuest({ nickname: '同名胜者', gender: 'female', server: 17 }),
    error => expectStatus(error, 409),
  );

  // 同一昵称在 18 服是另一个独立账号
  const other = createGuest({ nickname: '同名胜者', gender: 'male', server: 18 });
  assert.equal(other.player.server, 18);
  assert.notEqual(first.player.id, other.player.id);
});

test('好友推荐只含同服玩家，跨服加好友被拒', () => {
  const host = createGuest({ nickname: '十七服主人', gender: 'male', server: 17 });
  const peer = createGuest({ nickname: '十七服邻居', gender: 'female', server: 17 });
  const outsider = createGuest({ nickname: '十八服来客', gender: 'male', server: 18 });

  const view = listFriends(host.player.id);
  const ids = view.suggestions.map(row => row.playerId);
  assert.ok(ids.includes(peer.player.id), '同服玩家应出现在推荐里');
  assert.ok(!ids.includes(outsider.player.id), '跨服玩家不得出现在推荐里');

  assert.throws(
    () => requestFriend(host.player.id, outsider.player.id),
    /不同服务器/,
    '跨服好友申请必须被拒',
  );
  // 同服申请 → 接受 → 双向 accepted
  requestFriend(host.player.id, peer.player.id);
  acceptFriend(peer.player.id, host.player.id);
  const after = listFriends(host.player.id);
  assert.ok(after.friends.some(row => row.playerId === peer.player.id));
});

test('排行榜按服独立：同名次分服计算，?server 视图互不可见', () => {
  const host = createGuest({ nickname: '榜上十七', gender: 'male', server: 17 });
  const outsider = createGuest({ nickname: '榜上十八', gender: 'male', server: 18 });

  // 两人同榜同分（battle_wins 榜）
  updateLeaderboardScore('lb-battle-wins', host.player.id, 5);
  updateLeaderboardScore('lb-battle-wins', outsider.player.id, 5);

  // 全服聚合视图（缺省，向后兼容）能看到两人
  const global = getLeaderboardView('lb-battle-wins');
  assert.equal(global.entries.length, 2);

  // 按服视图各自只看到自己，且名次都是服内第 1
  const hostView = getLeaderboardView('lb-battle-wins', undefined, 17);
  assert.equal(hostView.entries.length, 1);
  assert.equal(hostView.entries[0].player_id, host.player.id);
  assert.equal(Number(hostView.entries[0].rank), 1);

  const guestView = getLeaderboardView('lb-battle-wins', undefined, 18);
  assert.equal(guestView.entries.length, 1);
  assert.equal(guestView.entries[0].player_id, outsider.player.id);

  // /me 名次自动按玩家所在服独立计算（不再被其他服玩家挤占名次）
  assert.equal(getPlayerRank('lb-battle-wins', host.player.id), 1);
  assert.equal(getPlayerRank('lb-battle-wins', outsider.player.id), 1);

  // 总览接口同样支持按服过滤
  const boards = listLeaderboards(17);
  const wins = boards.find(board => board.id === 'lb-battle-wins');
  assert.ok(wins);
  assert.equal(wins.entries.length, 1);
  assert.equal(wins.entries[0].player_id, host.player.id);
});

test('GM 玩家检索支持按服与关键字过滤', () => {
  const all = gmListPlayers({});
  assert.ok(all.length >= 4, '应能列出全部玩家');

  const server17 = gmListPlayers({ server: 17 });
  assert.ok(server17.length >= 1, '17 服应有玩家');
  assert.ok(server17.every(row => row.server === 17), '结果必须全部属于 17 服');

  const server18 = gmListPlayers({ server: 18 });
  assert.ok(server18.length >= 1, '18 服应有玩家');
  assert.ok(server18.every(row => row.server === 18), '结果必须全部属于 18 服');

  const byName = gmListPlayers({ keyword: '榜上十七' });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].nickname, '榜上十七');

  const empty = gmListPlayers({ server: 99 });
  assert.equal(empty.length, 0);
});

test('分服实时状态：玩家数来自实时统计，维护名单来自 SERVERS_MAINTENANCE 配置', () => {
  const status = listServerStatus();
  assert.equal(status.zoneSize, 18);
  assert.equal(status.servers.length, 18);

  const s17 = status.servers.find(row => row.server === 17);
  assert.ok((s17?.players ?? 0) >= 4, `17 服应统计到本用例已建号的 4 名玩家，实际 ${s17?.players}`);
  assert.equal(s17?.maintenance, false, '17 服不在维护名单');
  assert.equal(s17?.status, 'online', '测试库人数低于热闹阈值时应为顺畅');

  const s8 = status.servers.find(row => row.server === 8);
  assert.equal(s8?.maintenance, true, 'SERVERS_MAINTENANCE 默认包含 8 号服');
  assert.equal(s8?.status, 'offline', '维护中的服状态为 offline');

  const s18 = status.servers.find(row => row.server === 18);
  assert.ok((s18?.players ?? 0) >= 1, '18 服应统计到跨服用例玩家');
});
