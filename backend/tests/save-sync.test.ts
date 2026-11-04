/**
 * 云端存档文档（账号级多端同步）验证：
 * 1. 首次上传建版本 1，之后按乐观锁递增；
 * 2. 版本冲突返回 409 并携带服务端文档；
 * 3. 服务端白名单清洗：未知字段丢弃、非法引用（装备模板/食灵/星级）剔除；
 * 4. 存档按账号隔离：他人读不到、覆盖不了；
 * 5. 超限文档 422、非对象文档 400。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { clearRateLimits } from '../src/middleware/rate-limit.js';
import { createApp } from '../src/app.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-save-sync-${process.pid}.db`);

let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let base = '';

const call = async (
  pathName: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(base + pathName, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const createAccount = async (nickname: string) => {
  const response = await call('/api/auth/guest', { method: 'POST', body: { nickname } });
  assert.equal(response.status, 201);
  return {
    token: response.body?.data?.token as string,
    playerId: response.body?.data?.player?.id as string,
  };
};

before(async () => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
  clearRateLimits();
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('未同步过的账号读取到空文档，版本为 0', async () => {
  const account = await createAccount('存档甲一');
  const response = await call('/api/game/state/document', { token: account.token });
  assert.equal(response.status, 200);
  assert.equal(response.body?.data?.document, null);
  assert.equal(response.body?.data?.version, 0);
});

test('首次上传建立版本 1，回读内容一致且被服务端清洗', async () => {
  const account = await createAccount('存档乙二');
  const document = {
    coins: 8888,
    characters: ['青团', '冬阴功', '不存在的食灵'],
    stars: { '青团': 3, '冬阴功': 9, '入侵者': 5 },
    equipment: [
      { id: 'eq-test-1', templateId: 'weapon-rare', level: 2, acquiredAt: '2026-11-03T00:00:00.000Z' },
      { id: 'eq-test-2', templateId: 'fake-template', level: 0, acquiredAt: '2026-11-03T00:00:00.000Z' },
      { id: 'eq-test-1', templateId: 'armor-epic', level: 0, acquiredAt: '2026-11-03T00:00:00.000Z' },
    ],
    hackField: 'inject',
  };
  const put = await call('/api/game/state/document', { method: 'PUT', token: account.token, body: { document } });
  assert.equal(put.status, 200);
  assert.equal(put.body?.data?.version, 1);

  const saved = put.body?.data?.document;
  // 货币走服务端权威重算：客户端上报的 8888 被业务表余额（初始 50000）覆盖——防伪造
  assert.equal(saved.coins, 50000, '客户端上报货币应被服务端权威余额覆盖');
  assert.deepEqual(saved.characters, ['青团', '冬阴功'], '未收录食灵应被剔除');
  assert.deepEqual(saved.stars, { '青团': 3 }, '星级超界与未收录食灵应被剔除');
  assert.equal(saved.equipment.length, 1, '未知模板与重复 id 的装备应被剔除');
  assert.equal(saved.equipment[0].id, 'eq-test-1');
  assert.equal(saved.hackField, undefined, '未知字段不应入库');
  assert.equal(saved.profile, null);

  const get = await call('/api/game/state/document', { token: account.token });
  assert.equal(get.body?.data?.version, 1);
  assert.equal(get.body?.data?.document?.coins, 50000, '回读同样是权威余额');
});

test('版本递增与乐观锁冲突：409 携带服务端文档', async () => {
  const account = await createAccount('存档丙三');
  const first = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { coins: 100 } },
  });
  assert.equal(first.body?.data?.version, 1);

  // 携带正确版本 → 递增到 2（货币为服务端权威余额 50000，上报值不落库）
  const second = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { coins: 200 }, version: 1 },
  });
  assert.equal(second.status, 200);
  assert.equal(second.body?.data?.version, 2);
  assert.equal(second.body?.data?.document?.coins, 50000);

  // 已有存档时省略版本也必须冲突，不能覆盖云端。
  const missing = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { coins: 999 } },
  });
  assert.equal(missing.status, 409);
  assert.equal(missing.body?.error?.details?.version, 2);

  // 旧版本（模拟另一台设备）→ 409，并返回服务端当前文档
  const stale = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { coins: 999 }, version: 1 },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body?.error?.details?.version, 2);
  assert.equal(stale.body?.error?.details?.document?.coins, 50000);

  // 冲突后服务端数据未被覆盖
  const current = await call('/api/game/state/document', { token: account.token });
  assert.equal(current.body?.data?.document?.coins, 50000);
  assert.equal(current.body?.data?.version, 2);
});

test('存档按账号隔离：B 读不到也覆盖不了 A 的文档', async () => {
  const a = await createAccount('存档丁四');
  const b = await createAccount('存档戊五');

  await call('/api/game/state/document', {
    method: 'PUT', token: a.token, body: { document: { coins: 777, gems: 55 } },
  });

  // B 视角：自己从未同步过，只能看到空文档
  const viewB = await call('/api/game/state/document', { token: b.token });
  assert.equal(viewB.body?.data?.document, null);
  assert.equal(viewB.body?.data?.version, 0);

  // B 上传自己的文档不影响 A
  await call('/api/game/state/document', {
    method: 'PUT', token: b.token, body: { document: { coins: 1 } },
  });
  const viewA = await call('/api/game/state/document', { token: a.token });
  assert.equal(viewA.body?.data?.document?.coins, 50000, 'A 的货币仍是权威余额，未被 B 影响');
  assert.equal(viewA.body?.data?.document?.gems, 100, 'A 的灵晶同为权威余额');

  // 无令牌 / 伪造令牌 → 401
  assert.equal((await call('/api/game/state/document')).status, 401);
  assert.equal((await call('/api/game/state/document', { token: `${a.token}x` })).status, 401);
});

test('非法文档被拒绝：非对象 400，超限 422', async () => {
  const account = await createAccount('存档己六');
  const notObject = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: [1, 2, 3] },
  });
  assert.equal(notObject.status, 400);

  // 构造一份「结构全部合法但清洗后仍超 128KB」的文档：多条满回合战斗记录
  const longId = (prefix: string) => `${prefix}-${'u'.repeat(100)}`;
  const makeRecord = (index: number) => {
    const allyId = longId(`a${index}`);
    const enemyId = longId(`e${index}`);
    const units = [
      { id: allyId, name: '青团', side: 'ally', character: '青团', star: 1, maxHp: 1000, attack: 100, speed: 100 },
      { id: enemyId, name: '迷雾守卫', side: 'enemy', character: null, star: 1, maxHp: 2000, attack: 80, speed: 60 },
    ];
    // 每回合最多 6 次行动：72 个回合记录分布在 12 个回合内
    const turns = Array.from({ length: 72 }, (_, index) => ({
      round: (index % 12) + 1,
      actor: allyId,
      target: enemyId,
      kind: 'attack',
      skill: '春山回响',
      amount: 50,
      critical: false,
      health: { [allyId]: 1000, [enemyId]: 1950 - (index % 12) },
    }));
    return {
      version: 1, id: `battle-huge-${index}`, seed: index, stageId: '1-1', stageName: '林间小径', chapter: '第一章',
      startedAt: '2026-11-03T00:00:00.000Z', settledAt: '2026-11-03T00:01:00.000Z',
      power: 1000, enemyPower: 900, units, turns, win: true, rounds: 12, firstClear: false,
      rewards: [{ kind: 'coin', amount: 100, label: '金币' }], status: 'claimed',
    };
  };
  const huge = { profile: { name: '存档己六', gender: 'male', createdAt: '2026-11-03T00:00:00.000Z' }, battleHistory: Array.from({ length: 5 }, (_, index) => makeRecord(index)) };
  const hugeSize = Buffer.byteLength(JSON.stringify(huge), 'utf8');
  assert.ok(hugeSize < 256 * 1024, '请求体不应超过 HTTP 层上限');
  assert.ok(hugeSize > 128 * 1024, '清洗后的文档应超过云端存储上限');
  const oversized = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: huge },
  });
  assert.equal(oversized.status, 422);

  // 版本号非法 → 400（zod 校验）
  const badVersion = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { coins: 1 }, version: -1 },
  });
  assert.equal(badVersion.status, 400);
});

test('JSON 解析失败与请求体超限返回 400/413，而不是误报 500', async () => {
  const account = await createAccount('存档庚七');
  const malformed = await fetch(`${base}/api/game/state/document`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
    body: '{"document":',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json())?.error?.code, 'INVALID_JSON');

  const oversized = await fetch(`${base}/api/game/state/document`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ document: { text: 'x'.repeat(270 * 1024) } }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json())?.error?.code, 'PAYLOAD_TOO_LARGE');
});

test('服务端权威重算：伪造货币/胜场/首通/挑战次数全部被业务表覆盖', async () => {
  const account = await createAccount('重算验证甲');
  const headers = { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' };

  // 造一场真实胜利（服务端结算发奖、记 first_clear）
  const start = await fetch(`${base}/api/battles`, { method: 'POST', headers, body: JSON.stringify({ stageId: '1-1' }) });
  assert.equal(start.status, 201);
  const battleId = (await start.json())?.data?.battle?.id as string;
  const settle = await fetch(`${base}/api/battles/${battleId}/settle`, { method: 'POST', headers });
  assert.equal(settle.status, 200);
  const win = (await settle.json())?.data?.battle?.win as boolean;
  assert.equal(win, true, '1-1 低战力压制应获胜');

  // 伪造：天量货币 + 虚报胜场 + 未通关的首通 + 篡改挑战计数
  const forged = {
    coins: 999_999_999, gems: 999_999, books: 999, leaves: 999, potions: 999, chests: 999, medals: 999,
    battleWins: 999,
    firstClears: ['1-1', '2-3', '3-2', '4-1', '5-1'],
    battleChargeDate: '2000-01-01', dailyBattlesUsed: 0, battlePassesPurchased: 6,
    characters: ['青团'],
  };
  const put = await fetch(`${base}/api/game/state/document`, { method: 'PUT', headers, body: JSON.stringify({ document: forged }) });
  assert.equal(put.status, 200);
  const saved = (await put.json())?.data?.document as Record<string, unknown>;

  // 权威余额：结算奖励后的真实值（初始 50000 + 1-1 首通奖励），绝不可能是伪造的 999999999
  assert.notEqual(saved.coins, 999_999_999);
  assert.notEqual(saved.gems, 999_999);
  const state = await call('/api/game/state', { token: account.token });
  const data = state.body?.data as { save: Record<string, unknown>; save: { coins: number; gems: number; battleCharges: { dayKey: string; used: number; purchased: number } } };
  const authoritative = data.save;
  const charges = authoritative.battleCharges;
  assert.equal(saved.coins, authoritative.coins, '货币与权威余额一致');
  assert.equal(saved.gems, authoritative.gems);
  assert.equal(saved.battleWins, 1, '胜场以 battles 表真实统计覆盖');
  assert.deepEqual(saved.firstClears, ['1-1'], '首通以 battles 表真实记录覆盖');
  assert.equal(saved.battleChargeDate, charges.dayKey, '挑战日期重置为今日');
  assert.equal(saved.dailyBattlesUsed, charges.used, '挑战次数以 battle_passes 表覆盖');
  assert.equal(saved.battlePassesPurchased, charges.purchased, '挑战卡数量以 battle_passes 表覆盖');
});

test('v17 exp 存档同步：战斗经验入账、伪造 expEarned 被权威覆盖、升级消耗后同步回落', async () => {
  const account = await createAccount('经验同步甲');
  const headers = { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' };

  // 打一场 1-1 首通：exp = round(7000/90)×3 = 234
  const start = await fetch(`${base}/api/battles`, { method: 'POST', headers, body: JSON.stringify({ stageId: '1-1' }) });
  assert.equal(start.status, 201);
  const battleId = (await start.json())?.data?.battle?.id as string;
  const settle = await fetch(`${base}/api/battles/${battleId}/settle`, { method: 'POST', headers });
  assert.equal(settle.status, 200);
  const rewards = (await settle.json())?.data?.rewards as Array<{ kind: string; amount: number }>;
  const battleExp = rewards.filter(reward => reward.kind === 'exp').reduce((sum, reward) => sum + reward.amount, 0);
  assert.equal(battleExp, 234, '1-1 首通应发放 234 点掌灶人经验');

  // 伪造天量经验上传 → 必须被 progress.exp 权威覆盖（防伪造，与货币同策略）
  const put = await call('/api/game/state/document', {
    method: 'PUT', token: account.token, body: { document: { expEarned: 999_999_999 } },
  });
  assert.equal(put.status, 200);
  assert.equal(put.body?.data?.document?.expEarned, battleExp, 'expEarned 应被服务端权威经验覆盖');

  // 世界树 L1→L2 消耗 80 经验 + 金币 28000×0.2=5600 + 精华 15 → 存档展示位同步回落 234→154
  const upgrade = await call('/api/game/worldtree/upgrade', { method: 'POST', token: account.token });
  assert.equal(upgrade.status, 200, '初始资源与 234 经验应满足 L1→L2 升级');
  const after = await call('/api/game/state/document', { token: account.token });
  assert.equal(after.body?.data?.document?.expEarned, battleExp - 80, '升级扣减经验后，存档展示位同步回落');
});
