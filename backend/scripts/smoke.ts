/**
 * 端到端冒烟测试：真实启动 HTTP 服务，走完整业务链路，最后直接查库核对。
 * 运行：npm run smoke
 *
 * 验证目标
 *   1. 后端能连上数据库并完成迁移/种子
 *   2. 鉴权、参数校验、业务规则（余额不足、日限次）按预期返回
 *   3. 资源变更与账本流水严格对账：SUM(delta) === 当前余额
 */
import type { AddressInfo } from 'node:net';
import { closeDatabase, connectDatabase, countRows, execute, queryAll, queryOne } from '../src/db/index.js';
import { applyResourceDelta } from '../src/repositories/player.repository.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import type { GameSaveDto, Reward } from '../src/domain/types.js';

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failures.push(name);
  console.log(`  ✗ ${name}`);
  if (detail !== undefined) console.log(`      实际：${JSON.stringify(detail)}`);
}

type ApiResult = { status: number; body: { ok: boolean; data?: unknown; error?: { code: string; message: string } } | null };

async function main(): Promise<void> {
  connectDatabase();
  runMigrations();
  // seedCatalog 为幂等 upsert：无条件执行，保证已有库也能吃到新增的关卡/目录数据
  seedCatalog();

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const api = async (
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {},
  ): Promise<ApiResult> => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const body = (await response.json().catch(() => null)) as ApiResult['body'];
    return { status: response.status, body };
  };

  const saveOf = (result: ApiResult): GameSaveDto => (result.body?.data as { save: GameSaveDto }).save;

  console.log('\n[1] 健康检查与鉴权');
  const health = await api('/api/health');
  const healthData = health.body?.data as { database: { connected: boolean; tables: number; sqliteVersion: string } };
  check('GET /api/health 返回 200', health.status === 200);
  check('数据库连接可用', healthData?.database?.connected === true);
  check('表结构完整（58 张表，v7–v21 已迁移）', healthData?.database?.tables === 58, healthData?.database?.tables);
  console.log(`       SQLite ${healthData?.database?.sqliteVersion}，共 ${healthData?.database?.tables} 张表`);

  const servers = await api('/api/servers');
  const serverRows = (servers.body?.data as { servers?: Array<{ server: number; players: number; maintenance: boolean }> } | undefined)?.servers;
  check('GET /api/servers 返回实时分服统计', servers.status === 200 && Array.isArray(serverRows) && serverRows.length === 18, serverRows?.length);
  check('分服统计含真实玩家数（17 服非零）', (serverRows?.find(row => row.server === 17)?.players ?? 0) > 0);

  const adminPage = await fetch(`${base}/admin/`);
  const adminHtml = await adminPage.text();
  check('GET /admin/ 返回 GM 管理台静态页', adminPage.status === 200 && adminHtml.includes('GM 管理台'));

  const anonymous = await api('/api/game/state');
  check('未带令牌访问返回 401', anonymous.status === 401 && anonymous.body?.error?.code === 'UNAUTHORIZED');

  console.log('\n[2] 游客登录');
  const nickname = `烟测${String(Date.now() % 10000).padStart(4, '0')}`;
  const login = await api('/api/auth/guest', { method: 'POST', body: { nickname, gender: 'female', server: 17 } });
  check('POST /api/auth/guest 返回 201', login.status === 201, login.body);
  const loginData = login.body?.data as { token: string; player: { id: string; nickname: string }; save: GameSaveDto };
  const token = loginData?.token;
  const playerId = loginData?.player?.id;
  check('返回访问令牌', typeof token === 'string' && token.length > 20);
  check('初始金币 50000', loginData?.save?.coins === 50_000, loginData?.save?.coins);
  check('初始食灵为青团', loginData?.save?.characters?.[0] === '青团', loginData?.save?.characters);
  check('初始阵容已设置', loginData?.save?.formation?.length === 1, loginData?.save?.formation);

  const duplicate = await api('/api/auth/guest', { method: 'POST', body: { nickname } });
  check('重复昵称返回 409', duplicate.status === 409 && duplicate.body?.error?.code === 'CONFLICT');

  const badBody = await api('/api/game/craft', { method: 'POST', token, body: { times: 3 } });
  check('非法参数返回 400（校验层生效）', badBody.status === 400, badBody.body);

  console.log('\n[3] 业务规则：余额与日限次');
  const poorTrade = await api('/api/game/trade/t1', { method: 'POST', token });
  check('金币不足时兑换被拒绝（409）', poorTrade.status === 409, poorTrade.body?.error?.message);

  const mailClaim = await api('/api/game/mail/open/claim', { method: 'POST', token });
  check('领取邮件奖励成功', mailClaim.status === 200, mailClaim.body);
  const afterMail = saveOf(mailClaim);
  check('邮件奖励入账（金币 150000）', afterMail.coins === 150_000, afterMail.coins);
  check('邮件奖励入账（契约 +2）', afterMail.books === 12, afterMail.books);

  const repeatMail = await api('/api/game/mail/open/claim', { method: 'POST', token });
  check('重复领取邮件被拒绝', repeatMail.status === 409);

  const tradeLeaf = await api('/api/game/trade/t4', { method: 'POST', token });
  check('资源兑换成功（金币→精华）', tradeLeaf.status === 200, tradeLeaf.body?.error);
  const afterTrade = saveOf(tradeLeaf);
  check('兑换扣除金币', afterTrade.coins === 60_000, afterTrade.coins);
  check('兑换获得精华', afterTrade.leaves === 120, afterTrade.leaves);
  check('兑换次数计入当天', afterTrade.tradeCounts?.t4 === 1, afterTrade.tradeCounts);

  const gemTrade = await api('/api/game/trade/t3', { method: 'POST', token });
  check('灵晶兑换药剂成功', gemTrade.status === 200, gemTrade.body?.error);
  check('灵晶已扣除', saveOf(gemTrade).gems === 0, saveOf(gemTrade).gems);

  console.log('\n[4] 养成：炼制与升星');
  const craft = await api('/api/game/craft', { method: 'POST', token, body: { times: 1 } });
  check('炼制成功', craft.status === 200, craft.body?.error);
  const afterCraft = saveOf(craft);
  check('炼制扣除金币', afterCraft.coins === 38_000, afterCraft.coins);
  check('炼制产出药剂', afterCraft.potions === 390_000, afterCraft.potions);
  check('累计炼制次数 +1', afterCraft.crafted === 1, afterCraft.crafted);

  const ascend = await api('/api/game/characters/青团/ascend', { method: 'POST', token });
  check('青团升星成功', ascend.status === 200, ascend.body?.error);
  check('星级提升至 2', saveOf(ascend).stars['青团'] === 2, saveOf(ascend).stars);

  console.log('\n[5] 战斗：开战 → 结算 → 回放');
  const start = await api('/api/battles', { method: 'POST', token, body: { stageId: '1-1' } });
  check('开战成功（201）', start.status === 201, start.body?.error);
  const battle = (start.body?.data as { battle: { id: string; status: string; power: number } }).battle;
  check('战斗初始状态为 pending', battle.status === 'pending', battle.status);

  const pendingAgain = await api('/api/battles', { method: 'POST', token, body: { stageId: '1-1' } });
  check('重复开战被拒绝（避免刷奖励）', pendingAgain.status === 409);

  const settle = await api(`/api/battles/${battle.id}/settle`, { method: 'POST', token });
  check('结算成功', settle.status === 200, settle.body?.error);
  const settled = settle.body?.data as { battle: { status: string; win: boolean; turns: unknown[] }; rewards: Reward[] };
  check('战斗结果为胜', settled?.battle?.win === true, settled?.battle);
  check('战斗已标记结算', settled?.battle?.status === 'claimed', settled?.battle?.status);
  check('产出回放回合数据', (settled?.battle?.turns?.length ?? 0) > 0, settled?.battle?.turns?.length);
  check('胜利奖励已发放', (settled?.rewards?.length ?? 0) > 0, settled?.rewards);

  const replay = await api(`/api/battles/${battle.id}`, { token });
  check('可读取战斗回放', replay.status === 200);

  console.log('\n[5.1] 每日挑战次数：免费 4 次 → 挑战卡 → 总上限 10 次');
  const charges0 = await api('/api/game/state', { token });
  const charges1 = (charges0.body?.data as { save?: { battleCharges?: { used: number; remaining: number; freeLimit: number } } })?.save?.battleCharges;
  check('状态返回挑战次数视图', !!charges1 && charges1.freeLimit === 4, charges1);
  check('免费次数尚有剩余', (charges1?.remaining ?? 0) > 0, charges1?.remaining);
  // SQL 快进：模拟免费次数已用尽（不真打 4 场，保持冒烟脚本精简）
  execute('UPDATE battle_passes SET used = 4 WHERE player_id = ?', playerId);
  const charges2 = await api('/api/game/state', { token });
  const charges2Data = (charges2.body?.data as { save?: { battleCharges?: { remaining: number; canBuy: boolean } } })?.save?.battleCharges;
  check('免费用尽后 remaining 归零且可购买', charges2Data?.remaining === 0 && charges2Data?.canBuy === true, charges2Data);
  const gemsBeforePass0 = ((await api('/api/game/state', { token })).body?.data as { save: { gems: number } }).save.gems;
  if (gemsBeforePass0 < 30) applyResourceDelta(playerId, { gem: 100 }, 'smoke.grant');
  const gemsBeforePass = gemsBeforePass0 < 30 ? gemsBeforePass0 + 100 : gemsBeforePass0;
  const buyPass = await api('/api/game/battle-passes', { method: 'POST', token });
  check('挑战卡购买成功（200）', buyPass.status === 200, buyPass.body?.error);
  check('灵晶扣除 15', ((buyPass.body?.data as { save: { gems: number } })?.save?.gems ?? 0) === gemsBeforePass - 15, buyPass.body?.data);
  const buyPassAgain = await api('/api/game/battle-passes', { method: 'POST', token });
  check('免费仍用尽可继续购买（第 2 张）', buyPassAgain.status === 200, buyPassAgain.body?.error);
  // 快进到总上限：免费 4 + 已购 2 = 当前额度 6，直接置 used=10 验证封顶
  execute('UPDATE battle_passes SET used = 10, purchased = 2 WHERE player_id = ?', playerId);
  const battleAtCap = await api('/api/battles', { method: 'POST', token, body: { stageId: '1-1' } });
  check('达总上限 10 次后开战被拒（409）', battleAtCap.status === 409, battleAtCap.body?.error);
  const buyAtCap = await api('/api/game/battle-passes', { method: 'POST', token });
  check('达总上限后购买也被拒（409）', buyAtCap.status === 409, buyAtCap.body?.error);
  // 恢复计数，避免影响后续战斗段
  execute('UPDATE battle_passes SET used = 0, purchased = 0 WHERE player_id = ?', playerId);

  console.log('\n[5.2] 新章节关卡：第四章/终章馔妖接入');
  const ch4 = await api('/api/battles', { method: 'POST', token, body: { stageId: '4-1' } });
  check('4-1 开战成功（201）', ch4.status === 201, ch4.body?.error);
  const ch4Units = ((ch4.body?.data as { battle: { units: Array<{ side: string; name: string }> } })?.battle?.units ?? [])
    .filter(unit => unit.side === 'enemy').map(unit => unit.name);
  check('4-1 敌人为第四章馔妖', JSON.stringify(ch4Units) === JSON.stringify(['馔尘蛾', '雾隐食客', '冰髓甜魄']), ch4Units);
  const ch4Battle = (ch4.body?.data as { battle: { id: string } }).battle;
  const ch4Settle = await api(`/api/battles/${ch4Battle.id}/settle`, { method: 'POST', token });
  check('4-1 结算成功', ch4Settle.status === 200, ch4Settle.body?.error);
  check('4-1 回放回合数据完整', ((ch4Settle.body?.data as { battle?: { turns?: unknown[] } })?.battle?.turns?.length ?? 0) > 0);
  const finale = await api('/api/battles', { method: 'POST', token, body: { stageId: '5-1' } });
  check('5-1 开战成功（201）', finale.status === 201, finale.body?.error);
  const finaleUnits = ((finale.body?.data as { battle: { units: Array<{ side: string; name: string }> } })?.battle?.units ?? [])
    .filter(unit => unit.side === 'enemy').map(unit => unit.name);
  check('5-1 敌人为终章 Boss 编成（BOSS_STAGES feast）', JSON.stringify(finaleUnits) === JSON.stringify(['月桥守卫', '忘川馔侍', '忘川馔']), finaleUnits);
  const finaleBattle = (finale.body?.data as { battle: { id: string } }).battle;
  const finaleSettle = await api(`/api/battles/${finaleBattle.id}/settle`, { method: 'POST', token });
  check('5-1 结算成功', finaleSettle.status === 200, finaleSettle.body?.error);

  console.log('\n[5.5] 支付：下单 → 模拟网关回调 → 发放');
  const clientToken = crypto.randomUUID();
  const stateBefore = await api('/api/game/state', { token });
  const gemsBefore = (stateBefore.body?.data?.save as { gems?: number } | undefined)?.gems ?? 0;
  const orderCreated = await api('/api/payments/orders', {
    method: 'POST', token, body: { packId: 'gem-30', clientToken },
  });
  check('下单成功（201）', orderCreated.status === 201, orderCreated.body?.error);
  const orderId = orderCreated.body?.data?.orderId as string;
  const duplicateOrder = await api('/api/payments/orders', {
    method: 'POST', token, body: { packId: 'gem-30', clientToken },
  });
  check('同幂等键重复下单返回原订单', duplicateOrder.status === 201 && duplicateOrder.body?.data?.existing === true, duplicateOrder.body);
  const mockPaid = await api(`/api/payments/orders/${orderId}/mock-pay`, { method: 'POST', token });
  check('模拟支付成功（验签发放）', mockPaid.status === 200 && mockPaid.body?.data?.order?.status === 'paid', mockPaid.body?.error);
  check('礼包发放到账（灵晶 +330）', saveOf(mockPaid).gems === gemsBefore + 330, { before: gemsBefore, after: saveOf(mockPaid).gems });
  const badCallback = await api('/api/payments/callback', {
    method: 'POST',
    body: { orderId, gatewayTxn: 'smoke-forged', amount: 30, packId: 'gem-30', timestamp: Date.now(), signature: '0'.repeat(64) },
  });
  check('伪造回调签名被拒绝（403）', badCallback.status === 403, badCallback.status);
  const repeatedPay = await api(`/api/payments/orders/${orderId}/mock-pay`, { method: 'POST', token });
  check('已支付订单重复支付被拒绝（409）', repeatedPay.status === 409, repeatedPay.status);

  console.log('\n[6] 社交：协会签到');
  const guilds = await api('/api/social/guilds', { token });
  const guildRows = (guilds.body?.data as { guilds?: Array<{ id: string; name: string; joinable: boolean }> } | undefined)?.guilds;
  check('协会列表可读', guilds.status === 200 && Array.isArray(guildRows));
  // 动态选择未满协会：烟测库可能积累大量玩家把固定协会挤满（CONFLICT 是环境数据问题而非代码缺陷）
  const joinable = guildRows?.find(row => row.joinable);
  const join = joinable ? await api(`/api/social/guilds/${joinable.id}/join`, { method: 'POST', token }) : null;
  check('加入协会成功', join?.status === 200, join?.body?.error ?? '无未满协会可加入（列表如下）');
  if (!joinable) console.log(`       协会均已满员：${guildRows?.map(row => row.id).join('、')}`);
  const checkIn = await api('/api/social/guilds/checkin', { method: 'POST', token });
  check('协会签到成功', joinable ? checkIn.status === 200 : checkIn.status === 409, checkIn.body?.error);
  const doubleCheckIn = await api('/api/social/guilds/checkin', { method: 'POST', token });
  check('当日重复签到被拒绝', doubleCheckIn.status === 409);
  const chat = await api('/api/social/chat', { method: 'POST', token, body: { channel: 'world', body: '烟测消息' } });
  check('发送世界消息成功', chat.status === 201, chat.body?.error);

  console.log('\n[7] 回查数据库：账本对账');
  const player = queryOne<{ id: string; nickname: string }>('SELECT id, nickname FROM players WHERE id = ?', playerId);
  check('玩家记录已落库', player?.nickname === nickname, player);

  const balances = queryOne<Record<string, number>>(
    'SELECT coins, gems, books, leaves, potions, chests, medals FROM player_resources WHERE player_id = ?',
    playerId,
  );
  const ledger = queryAll<{ currency: string; total: number; entries: number }>(
    `SELECT currency, SUM(delta) AS total, COUNT(*) AS entries
       FROM resource_ledger WHERE player_id = ? GROUP BY currency`,
    playerId,
  );
  const columns: Record<string, string> = {
    coin: 'coins', gem: 'gems', book: 'books', leaf: 'leaves', potion: 'potions', chest: 'chests', medal: 'medals',
  };
  let ledgerConsistent = true;
  for (const row of ledger) {
    const column = columns[row.currency];
    if (!column) continue;
    if (Number(row.total) !== Number(balances?.[column])) {
      ledgerConsistent = false;
      console.log(`       ${row.currency}: 流水合计 ${row.total} ≠ 余额 ${balances?.[column]}`);
    }
  }
  check('每个币种流水合计等于当前余额', ledgerConsistent);
  console.log(`       流水条目：${ledger.map(row => `${row.currency}×${row.entries}`).join('，')}`);

  const battleRow = queryOne<{ status: string; win: number }>('SELECT status, win FROM battles WHERE id = ?', battle.id);
  check('战斗结果已持久化', battleRow?.status === 'claimed' && battleRow?.win === 1, battleRow);

  const turnCount = countRows('SELECT COUNT(*) AS total FROM battle_turns WHERE battle_id = ?', battle.id);
  check('回放回合逐条落库', turnCount > 0, turnCount);

  const sessionCount = countRows('SELECT COUNT(*) AS total FROM player_sessions WHERE player_id = ?', playerId);
  check('会话已落库', sessionCount === 1, sessionCount);

  const plainToken = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_sessions WHERE token_hash = ?',
    token,
  );
  check('库中不存放令牌明文', Number(plainToken?.total) === 0);

  console.log('\n[8] 登出后令牌失效');
  const logout = await api('/api/auth/logout', { method: 'POST', token });
  check('登出成功', logout.status === 200);
  const afterLogout = await api('/api/game/state', { token });
  check('登出后访问被拒绝（401）', afterLogout.status === 401);

  server.close();
  closeDatabase();

  console.log(`\n${'─'.repeat(56)}`);
  if (failures.length) {
    console.log(`结果：${passed} 通过，${failures.length} 失败`);
    failures.forEach(name => console.log(`  失败项：${name}`));
    process.exitCode = 1;
    return;
  }
  console.log(`结果：全部 ${passed} 项断言通过 ✅`);
}

main().catch(error => {
  console.error('[smoke] 执行异常：', error);
  process.exitCode = 1;
  closeDatabase();
});
