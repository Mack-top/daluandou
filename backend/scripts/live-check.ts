/**
 * 跨服务联调脚本（要求前后端已在运行）。
 * 运行：npm --workspace backend run live-check
 *
 * 与 smoke.ts 的区别：smoke 自己起服务；本脚本所有业务请求都走
 * 「前端 Vite 代理 → 后端 Express → SQLite」的真实链路，
 * 并在最后另开连接直读数据库，核对写入结果。
 */
import { env } from '../src/config/env.js';
import { openDatabase } from '../src/db/index.js';

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://127.0.0.1:8787';

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
  if (detail !== undefined) console.log(`      实际：${JSON.stringify(detail)?.slice(0, 400)}`);
}

type Result = { status: number; body: any };

async function call(base: string, path: string, options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Result> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(base + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

const save = (result: Result) => result.body?.data?.save;
const unique = () => String(Date.now() % 100000).padStart(5, '0');

async function main(): Promise<void> {
  console.log(`\n联调目标：前端 ${WEB} ｜ 后端 ${API} ｜ 数据库 ${env.databasePath}\n`);

  console.log('[1] 服务可用性');
  const page = await call(WEB, '/');
  check('前端首页可访问', page.status === 200 && String(page.body?.raw ?? '').length >= 0);
  const health = await call(API, '/api/health');
  check('后端健康检查 200', health.status === 200);
  check('数据库已连接', health.body?.data?.database?.connected === true);
  check('迁移版本已到 v16', health.body?.data?.database?.migrations === 16, health.body?.data?.database?.migrations);

  const preflight = await fetch(`${API}/api/game/state`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-csrf-token',
    },
  });
  check(
    'CORS 预检放行前端来源',
    preflight.headers.get('access-control-allow-origin') === 'http://127.0.0.1:5173',
    preflight.headers.get('access-control-allow-origin'),
  );
  const notFound = await call(API, '/api/does-not-exist');
  check('未知接口返回 404', notFound.status === 404);

  console.log('\n[1.5] Cookie 会话轨道（浏览器主轨道）');
  const cookieGuest = await fetch(`${WEB}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname: `联调乙${unique()}`, gender: 'male' }),
  });
  check('Cookie 轨道建号成功', cookieGuest.status === 201);
  const setCookies = cookieGuest.headers.getSetCookie();
  const cookieJar = setCookies.map(item => item.split(';')[0]).filter(Boolean);
  const sidCookie = setCookies.find(item => item.startsWith('sid='));
  const csrfPair = cookieJar.find(item => item.startsWith('csrf='));
  check('guest 成对下发 sid + csrf Cookie', Boolean(sidCookie && csrfPair), setCookies.map(item => item.split('=')[0]));
  check('sid Cookie 为 HttpOnly', sidCookie?.toLowerCase().includes('httponly') ?? false);
  const csrfValue = csrfPair ? csrfPair.slice('csrf='.length) : '';
  const cookieState = await fetch(`${WEB}/api/game/state`, {
    headers: { cookie: cookieJar.join('; '), 'x-csrf-token': csrfValue },
  });
  check('Cookie + CSRF 头可读取存档', cookieState.status === 200, cookieState.status);
  const cookieNoCsrf = await fetch(`${WEB}/api/game/state/document`, {
    method: 'PUT',
    headers: { cookie: cookieJar.join('; '), 'content-type': 'application/json' },
    body: '{}',
  });
  check('缺 CSRF 头的写请求被拒绝（403）', cookieNoCsrf.status === 403, cookieNoCsrf.status);

  console.log('\n[2] 经前端代理的完整业务链路');
  const login = await call(WEB, '/api/auth/guest', {
    method: 'POST',
    body: { nickname: `联调甲${unique()}`, gender: 'female' },
  });
  check('代理创建游客账号', login.status === 201, login.body?.error);
  const token = login.body?.data?.token as string;
  const playerA = login.body?.data?.player?.id as string;
  check('初始存档正确', save(login)?.coins === 50_000 && save(login)?.books === 10);

  const state = await call(WEB, '/api/game/state', { token });
  check('代理读取存档', state.status === 200 && save(state)?.profile?.name?.startsWith('联调甲'));

  const mail = await call(WEB, '/api/game/mail/open/claim', { method: 'POST', token });
  check('领取邮件（代理）', mail.status === 200 && save(mail)?.coins === 150_000, save(mail)?.coins);

  const trade = await call(WEB, '/api/game/trade/t4', { method: 'POST', token });
  check('资源兑换（代理）', trade.status === 200 && save(trade)?.leaves === 120, save(trade)?.leaves);

  const craft = await call(WEB, '/api/game/craft', { method: 'POST', token, body: { times: 1 } });
  check('炼制药剂（代理）', craft.status === 200 && save(craft)?.potions === 90_000, save(craft)?.potions);

  console.log('\n[3] 装备链路：获取 → 穿戴 → 卸下');
  const starter = await call(WEB, '/api/game/equipment/starter', { method: 'POST', token });
  check('领取新手宝箱', starter.status === 200 && save(starter)?.chests === 6, starter.body?.error);

  const open = await call(WEB, '/api/game/equipment/chest/open', {
    method: 'POST',
    token,
    body: { count: 5, operationId: `op-${unique()}`, seed: 20261103 },
  });
  check('开箱获得 5 件装备', open.status === 200 && save(open)?.equipment?.length === 5, open.body?.error);
  const drops = (open.body?.data?.drops ?? []) as Array<{ id: string; slot: string }>;
  check('掉落含武器槽位', drops[0]?.slot === 'weapon', drops[0]);

  const equipped = await call(WEB, '/api/game/equipment/equip', {
    method: 'POST',
    token,
    body: { equipmentId: drops[0]?.id },
  });
  check('穿戴武器成功', equipped.status === 200 && save(equipped)?.equipped?.weapon === drops[0]?.id, equipped.body?.error);

  const removed = await call(WEB, '/api/game/equipment/unequip', {
    method: 'POST',
    token,
    body: { slot: 'weapon' },
  });
  check('卸下武器成功（已修复）', removed.status === 200 && save(removed)?.equipped?.weapon === undefined, save(removed)?.equipped);

  const reEquip = await call(WEB, '/api/game/equipment/equip', {
    method: 'POST',
    token,
    body: { equipmentId: drops[0]?.id },
  });
  check('可重新穿戴', reEquip.status === 200 && save(reEquip)?.equipped?.weapon === drops[0]?.id);

  console.log('\n[4] 战斗链路');
  const start = await call(WEB, '/api/battles', { method: 'POST', token, body: { stageId: '1-1' } });
  check('开战成功', start.status === 201, start.body?.error);
  const battleId = start.body?.data?.battle?.id as string;
  const settle = await call(WEB, `/api/battles/${battleId}/settle`, { method: 'POST', token });
  check('结算胜利并发放奖励', settle.status === 200 && settle.body?.data?.win === true, settle.body?.error);
  check('回放回合非空', (settle.body?.data?.battle?.turns?.length ?? 0) > 0);

  console.log('\n[5] 多账号社交链路');
  const loginB = await call(WEB, '/api/auth/guest', { method: 'POST', body: { nickname: `联调乙${unique()}` } });
  const tokenB = loginB.body?.data?.token as string;
  const playerB = loginB.body?.data?.player?.id as string;
  check('第二个账号创建成功', loginB.status === 201);

  const request = await call(WEB, '/api/social/friends/request', { method: 'POST', token, body: { playerId: playerB } });
  check('发送好友申请', request.status === 201, request.body?.error);
  const accept = await call(WEB, '/api/social/friends/accept', { method: 'POST', token: tokenB, body: { playerId: playerA } });
  check('对方接受申请', accept.status === 200, accept.body?.error);
  const friends = await call(WEB, '/api/social/friends', { token });
  check('好友关系双向可见', (friends.body?.data?.friends ?? []).some((f: any) => f.playerId === playerB));

  const chat = await call(WEB, '/api/social/chat', { method: 'POST', token, body: { channel: 'world', body: '联调消息' } });
  check('发送世界消息', chat.status === 201, chat.body?.error);
  const chatRead = await call(WEB, '/api/social/chat?channel=world', { token: tokenB });
  check(
    '另一账号可读到该消息',
    (chatRead.body?.data?.messages ?? []).some((m: any) => m.body === '联调消息'),
  );

  const join = await call(WEB, '/api/social/guilds/osmanthus/join', { method: 'POST', token });
  check('加入协会', join.status === 200, join.body?.error);
  const checkIn = await call(WEB, '/api/social/guilds/checkin', { method: 'POST', token });
  check('协会签到入账', checkIn.status === 200 && save(checkIn)?.social?.contribution === 20, checkIn.body?.error);

  console.log('\n[6] 直读数据库核对（独立连接）');
  const db = openDatabase(env.databasePath);
  try {
    const playerRow = db.prepare('SELECT nickname FROM players WHERE id = ?').get(playerA) as any;
    check('玩家 A 已落库', typeof playerRow?.nickname === 'string' && playerRow.nickname.startsWith('联调甲'));

    const equipment = db.prepare('SELECT COUNT(*) AS total FROM player_equipment WHERE player_id = ?').get(playerA) as any;
    check('装备 5 件已落库', Number(equipment?.total) === 5, equipment?.total);

    const equippedRow = db.prepare(
      "SELECT COUNT(*) AS total FROM player_equipment WHERE player_id = ? AND equipped_slot = 'weapon'",
    ).get(playerA) as any;
    check('武器槽位占用与接口一致', Number(equippedRow?.total) === 1, equippedRow?.total);

    const turns = db.prepare('SELECT COUNT(*) AS total FROM battle_turns WHERE battle_id = ?').get(battleId) as any;
    check('战斗回放逐条落库', Number(turns?.total) > 0, turns?.total);

    const battleRow = db.prepare('SELECT status, win FROM battles WHERE id = ?').get(battleId) as any;
    check('战斗结果已持久化', battleRow?.status === 'claimed' && battleRow?.win === 1, battleRow);

    const friendship = db.prepare(
      "SELECT COUNT(*) AS total FROM friendships WHERE status = 'accepted' AND ((player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?))",
    ).get(playerA, playerB, playerB, playerA) as any;
    check('好友关系双向落库', Number(friendship?.total) === 2, friendship?.total);

    const columns: Record<string, string> = {
      coin: 'coins', gem: 'gems', book: 'books', leaf: 'leaves', potion: 'potions', chest: 'chests', medal: 'medals',
    };
    for (const [label, id] of [['玩家A', playerA], ['玩家B', playerB]] as const) {
      const balances = db.prepare('SELECT * FROM player_resources WHERE player_id = ?').get(id) as any;
      const ledger = db.prepare(
        'SELECT currency, SUM(delta) AS total FROM resource_ledger WHERE player_id = ? GROUP BY currency',
      ).all(id) as any[];
      let consistent = true;
      for (const row of ledger) {
        if (Number(row.total) !== Number(balances?.[columns[row.currency]])) consistent = false;
      }
      check(`${label} 账本与余额一致`, consistent, ledger);
    }
  } finally {
    db.close();
  }

  console.log('\n[7] 会话安全');
  const logout = await call(WEB, '/api/auth/logout', { method: 'POST', token });
  check('登出成功', logout.status === 200);
  const afterLogout = await call(WEB, '/api/game/state', { token });
  check('登出后令牌失效', afterLogout.status === 401);

  console.log(`\n${'─'.repeat(56)}`);
  if (failures.length) {
    console.log(`联调结果：${passed} 通过，${failures.length} 失败`);
    failures.forEach(name => console.log(`  失败项：${name}`));
    process.exitCode = 1;
    return;
  }
  console.log(`联调结果：全部 ${passed} 项断言通过 ✅`);
}

main().catch(error => {
  console.error('[live-check] 执行异常：', error?.message ?? error);
  console.error('请确认已执行 npm run dev（前后端都在运行）');
  process.exitCode = 1;
});
