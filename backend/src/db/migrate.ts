import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAsset, isSea } from 'node:sea';
import { closeDatabase, connectDatabase, execute, getDb, queryAll, queryOne } from './index.js';
import { nowIso } from '../lib/clock.js';
import { isMain } from '../lib/is-main.js';
import { env } from '../config/env.js';

/**
 * schema.sql 加载：SEA 单文件模式（打包 exe）从内嵌资源读取；
 * 常规模式从模块同目录读取（dev=src/db，tsc 产物=dist/db 由 copy-assets 复制）。
 */
function loadSchemaSql(): string {
  if (isSea()) return Buffer.from(getAsset('schema.sql')).toString('utf8');
  const schemaFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  return readFileSync(schemaFile, 'utf8');
}

/**
 * v2：把 player_equipment.level 从 1 起改为 0 起（0 = 未强化），与前端口径对齐。
 * SQLite 不能直接改 CHECK 约束，只能重建表；先探测现有定义，已是新结构则跳过。
 */
function migrateEquipmentLevelToZeroBased(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'player_equipment'",
  );
  if (!current || current.sql.includes('BETWEEN 0 AND 5')) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE player_equipment_v2 (
      id            TEXT PRIMARY KEY,
      player_id     TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
      template_id   TEXT NOT NULL REFERENCES equipment_defs (id),
      level         INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
      equipped_slot TEXT CHECK (equipped_slot IN ('weapon', 'crown', 'armor', 'charm', 'relic', 'crest')),
      obtained_at   TEXT NOT NULL
    );`);
    db.exec(`INSERT INTO player_equipment_v2 (id, player_id, template_id, level, equipped_slot, obtained_at)
             SELECT id, player_id, template_id, MAX(level - 1, 0), equipped_slot, obtained_at FROM player_equipment;`);
    db.exec('DROP TABLE player_equipment;');
    db.exec('ALTER TABLE player_equipment_v2 RENAME TO player_equipment;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_player_equipment_player ON player_equipment (player_id);');
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_player_equipment_slot
               ON player_equipment (player_id, equipped_slot) WHERE equipped_slot IS NOT NULL;`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v2：player_equipment.level 已迁移为 0 起');
}

/**
 * v8：给 stage_defs 补 scene_id 列（通用场景归属）。
 * ALTER TABLE ADD COLUMN 带 REFERENCES 在 SQLite 中合法；先探测现有定义，已有该列则跳过。
 * 存量关卡的场景回填由 seed 幂等完成（upsert stage_defs 时写入默认场景 id），
 * 避免迁移钩子引用 seed 数据造成迁移与种子耦合。
 */
function migrateStageSceneId(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stage_defs'",
  );
  if (!current || current.sql.includes('scene_id')) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec('ALTER TABLE stage_defs ADD COLUMN scene_id TEXT REFERENCES scene_defs (id);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v8：stage_defs 已补 scene_id 列');
}

/**
 * v14：主线任务链（P0）——quest_defs 扩展 metric 白名单并新增 ref_id 列。
 * SQLite 不能直接改 CHECK 约束，重建表；先探测现有定义，已是新结构则跳过。
 * quest_defs 为静态配置表，无业务索引，重建成本低；player_quest_claims 的外键
 * 指向本表 id，重建期间 foreign_keys OFF 保证复制与改名原子完成。
 */
function migrateQuestMetricsExpansion(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quest_defs'",
  );
  if (!current || current.sql.includes("'stage_clear'")) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE quest_defs_v14 (
      id          TEXT PRIMARY KEY,
      group_name  TEXT NOT NULL CHECK (group_name IN ('日常', '成长', '主线')),
      name        TEXT NOT NULL,
      detail      TEXT NOT NULL,
      target      INTEGER NOT NULL CHECK (target > 0),
      metric      TEXT NOT NULL DEFAULT 'none' CHECK (metric IN (
                    'daily_summons', 'daily_claimed_tiers', 'daily_login_rewards',
                    'first_purchase', 'character_count', 'worldtree_level',
                    'battle_wins', 'contract_purchase', 'none',
                    'stage_clear', 'mail_claimed', 'formation_slots', 'summons_total',
                    'equipment_worn', 'crafted_total', 'friend_count', 'market_today',
                    'astrology_nodes', 'equipment_chests', 'idle_claimed', 'trade_used',
                    'stars_reached', 'login_days')),
      ref_id      TEXT,
      reward_json TEXT NOT NULL DEFAULT '[]',
      sort_index  INTEGER NOT NULL DEFAULT 0
    );`);
    db.exec(`INSERT INTO quest_defs_v14 (id, group_name, name, detail, target, metric, ref_id, reward_json, sort_index)
             SELECT id, group_name, name, detail, target, metric, NULL, reward_json, sort_index FROM quest_defs;`);
    db.exec('DROP TABLE quest_defs;');
    db.exec('ALTER TABLE quest_defs_v14 RENAME TO quest_defs;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v14：quest_defs 已扩展 metric 白名单与 ref_id 列');
}

/**
 * v15：成长维度（经验表 / 等级表 / 职业表）。
 * 三张新表由 schema.sql 的 CREATE TABLE IF NOT EXISTS 完成，无需处理；这里只补两处存量结构：
 *   1) equipment_defs 补 required_level 列。注意 SQLite 限制：外键开启时 ALTER ADD COLUMN
 *      带 REFERENCES 的列默认值必须为 NULL，因此必须在 foreign_keys = OFF 下执行（v8 的
 *      scene_id 可空默认值不踩此坑，v15 的 DEFAULT 1 会踩）。
 *   2) character_defs.role 挂外键 → class_defs.id，SQLite 不能直接加约束，按 v2/v14 先例重建表。
 * role 取值沿用既有文案（治疗/法术/输出/辅助/防御），class_defs 种子在 seedCatalog 最先写入，
 * 迁移与种子之间的短暂空窗不会触发外键校验（外键仅在开启后的 DML 时检查）。
 */
function migrateGrowthDimensions(): void {
  const db = getDb();

  const equipment = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'equipment_defs'",
  );
  if (equipment && !equipment.sql.includes('required_level')) {
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.exec(`ALTER TABLE equipment_defs ADD COLUMN required_level INTEGER NOT NULL DEFAULT 1
                 CHECK (required_level BETWEEN 1 AND 100) REFERENCES level_exp_defs (level);`);
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
    console.log('[migrate] v15：equipment_defs 已补 required_level 列');
  }

  const character = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'character_defs'",
  );
  if (!character || character.sql.includes('REFERENCES class_defs')) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE character_defs_v15 (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      element     TEXT NOT NULL,
      rarity      TEXT NOT NULL CHECK (rarity IN ('R', 'SR', 'SSR')),
      role        TEXT NOT NULL REFERENCES class_defs (id),
      detail      TEXT NOT NULL DEFAULT '',
      portrait    TEXT NOT NULL DEFAULT '',
      base_power  INTEGER NOT NULL CHECK (base_power > 0)
    );`);
    db.exec(`INSERT INTO character_defs_v15 (id, name, title, element, rarity, role, detail, portrait, base_power)
             SELECT id, name, title, element, rarity, role, detail, portrait, base_power FROM character_defs;`);
    db.exec('DROP TABLE character_defs;');
    db.exec('ALTER TABLE character_defs_v15 RENAME TO character_defs;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v15：character_defs.role 已挂靠 class_defs 外键');
}

/**
 * v16：按服隔离第一步——players 昵称唯一约束从全局改为 (server, nickname)。
 * SQLite 不能直接改 UNIQUE 约束，按 v2/v14/v15 先例重建表；
 * 全局唯一严格于按服唯一，存量数据必然满足新约束，复制不会失败。
 * players 被全部 player_* 表外键引用，重建期间 foreign_keys OFF 保证原子完成。
 */
function migrateServerScopedIdentity(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players'",
  );
  if (!current || current.sql.includes('UNIQUE (server, nickname)')) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE players_v16 (
      id              TEXT PRIMARY KEY,
      nickname        TEXT NOT NULL,
      gender          TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      server          INTEGER NOT NULL DEFAULT 17 CHECK (server BETWEEN 1 AND 99),
      worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (worldtree_level BETWEEN 1 AND 30),
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      UNIQUE (server, nickname)
    );`);
    db.exec(`INSERT INTO players_v16 (id, nickname, gender, server, worldtree_level, created_at, updated_at)
             SELECT id, nickname, gender, server, worldtree_level, created_at, updated_at FROM players;`);
    db.exec('DROP TABLE players;');
    db.exec('ALTER TABLE players_v16 RENAME TO players;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v16：players 昵称唯一约束已改为按服（server, nickname）');
}

/**
 * v17：数值核心 v2 —— 世界树（=掌灶人等级）上限 30 → 100。
 * SQLite 不能直接改 CHECK 约束，按 v16 先例重建 players；
 * scene_defs.unlock_worldtree_level 共享同一解锁域，一并重建（静态配置表，5 行，重建零风险）。
 * 存量 worldtree_level 最大 30，必然满足新约束，复制不会失败。
 */
function migrateWorldtreeCap100(): void {
  const db = getDb();

  const players = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players'",
  );
  if (players && players.sql.includes('worldtree_level BETWEEN 1 AND 30')) {
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.exec('BEGIN');
      db.exec(`CREATE TABLE players_v17 (
        id              TEXT PRIMARY KEY,
        nickname        TEXT NOT NULL,
        gender          TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        server          INTEGER NOT NULL DEFAULT 17 CHECK (server BETWEEN 1 AND 99),
        worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (worldtree_level BETWEEN 1 AND 100),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        UNIQUE (server, nickname)
      );`);
      db.exec(`INSERT INTO players_v17 (id, nickname, gender, server, worldtree_level, created_at, updated_at)
               SELECT id, nickname, gender, server, worldtree_level, created_at, updated_at FROM players;`);
      db.exec('DROP TABLE players;');
      db.exec('ALTER TABLE players_v17 RENAME TO players;');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
    console.log('[migrate] v17：players.worldtree_level 上限已放开至 100');
  }

  const scenes = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'scene_defs'",
  );
  if (scenes && scenes.sql.includes('unlock_worldtree_level BETWEEN 1 AND 30')) {
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.exec('BEGIN');
      db.exec(`CREATE TABLE scene_defs_v17 (
        id                     TEXT PRIMARY KEY,
        name                   TEXT NOT NULL,
        type                   TEXT NOT NULL CHECK (type IN ('battle', 'idle', 'guild', 'manor', 'activity')),
        background             TEXT NOT NULL DEFAULT '',
        music                  TEXT NOT NULL DEFAULT '',
        unlock_worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (unlock_worldtree_level BETWEEN 1 AND 100),
        order_index            INTEGER NOT NULL DEFAULT 0,
        updated_at             TEXT NOT NULL
      );`);
      db.exec(`INSERT INTO scene_defs_v17 (id, name, type, background, music, unlock_worldtree_level, order_index, updated_at)
               SELECT id, name, type, background, music, unlock_worldtree_level, order_index, updated_at FROM scene_defs;`);
      db.exec('DROP TABLE scene_defs;');
      db.exec('ALTER TABLE scene_defs_v17 RENAME TO scene_defs;');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
    console.log('[migrate] v17：scene_defs 解锁域已随世界树放开至 100');
  }
}

/**
 * v17（续）：player_progress 补 exp 列——掌灶人经验余额（服务端权威）。
 * 无外键引用，普通 ADD COLUMN 即可（v15 的 REFERENCES + DEFAULT 才需要 foreign_keys OFF）。
 */
function migrateProgressExpColumn(): void {
  const hasColumn = queryOne<{ name: string }>(
    "SELECT name FROM pragma_table_info('player_progress') WHERE name = 'exp'",
  );
  if (hasColumn) return;

  const db = getDb();
  db.exec('ALTER TABLE player_progress ADD COLUMN exp INTEGER NOT NULL DEFAULT 0 CHECK (exp >= 0);');
  console.log('[migrate] v17：player_progress 已补 exp 列（掌灶人经验余额）');
}

/**
 * v17（续）：强化上限 5 → 12 —— player_equipment.level CHECK 重建。
 * SQLite 不能直接改 CHECK 约束，按 v2 先例重建；存量 level ≤ 5 必然满足新约束。
 */
function migrateEnhancementCap12(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'player_equipment'",
  );
  if (!current || current.sql.includes('BETWEEN 0 AND 12')) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE player_equipment_v17 (
      id            TEXT PRIMARY KEY,
      player_id     TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
      template_id   TEXT NOT NULL REFERENCES equipment_defs (id),
      level         INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 12),
      equipped_slot TEXT CHECK (equipped_slot IN ('weapon', 'crown', 'armor', 'charm', 'relic', 'crest')),
      obtained_at   TEXT NOT NULL
    );`);
    db.exec(`INSERT INTO player_equipment_v17 (id, player_id, template_id, level, equipped_slot, obtained_at)
             SELECT id, player_id, template_id, level, equipped_slot, obtained_at FROM player_equipment;`);
    db.exec('DROP TABLE player_equipment;');
    db.exec('ALTER TABLE player_equipment_v17 RENAME TO player_equipment;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_player_equipment_player ON player_equipment (player_id);');
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_player_equipment_slot
               ON player_equipment (player_id, equipped_slot) WHERE equipped_slot IS NOT NULL;`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v17：player_equipment.level 强化上限已放开至 12');
}

/** 迁移清单：新增结构时追加一项，不要修改历史版本。 */
/**
 * v18：quest_defs metric 白名单扩展——每日任务 leaf 档（设计 §3.3②）新增 daily_battle_wins
 * （今日战斗胜利，battles.settled_at 按服务器本地日界统计）。按 v14 先例重建表。
 */
function migrateQuestDailyBattleMetric(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quest_defs'",
  );
  if (!current || current.sql.includes("'daily_battle_wins'")) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE quest_defs_v18 (
      id          TEXT PRIMARY KEY,
      group_name  TEXT NOT NULL CHECK (group_name IN ('日常', '成长', '主线')),
      name        TEXT NOT NULL,
      detail      TEXT NOT NULL,
      target      INTEGER NOT NULL CHECK (target > 0),
      metric      TEXT NOT NULL DEFAULT 'none' CHECK (metric IN (
                    'daily_summons', 'daily_claimed_tiers', 'daily_login_rewards',
                    'first_purchase', 'character_count', 'worldtree_level',
                    'battle_wins', 'contract_purchase', 'none',
                    'stage_clear', 'mail_claimed', 'formation_slots', 'summons_total',
                    'equipment_worn', 'crafted_total', 'friend_count', 'market_today',
                    'astrology_nodes', 'equipment_chests', 'idle_claimed', 'trade_used',
                    'stars_reached', 'login_days', 'daily_battle_wins')),
      ref_id      TEXT,
      reward_json TEXT NOT NULL DEFAULT '[]',
      sort_index  INTEGER NOT NULL DEFAULT 0
    );`);
    db.exec(`INSERT INTO quest_defs_v18 (id, group_name, name, detail, target, metric, ref_id, reward_json, sort_index)
             SELECT id, group_name, name, detail, target, metric, ref_id, reward_json, sort_index FROM quest_defs;`);
    db.exec('DROP TABLE quest_defs;');
    db.exec('ALTER TABLE quest_defs_v18 RENAME TO quest_defs;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v18：quest_defs metric 白名单已加入 daily_battle_wins');
}

/**
 * v19（§2.5 100+ 级无墙延伸）：等级域 100 → 150。
 * 经验曲线为闭式公式（分段几何 80×r^(L-1)，61+ 恒 1.07），101–149 级以 L99 需求为基数
 * 天然续接，无需新增曲线段；成长系数 growth_bp 在 100 级封顶 2.6（公式层 clamp，
 * 存量 1–100 曲线零漂移）。SQLite 无法 ALTER CHECK，四处等级域 CHECK 重建
 * （level_exp_defs / players / equipment_defs / scene_defs），数据原样复制；
 * seed 随后重灌 1..150 级曲线行。
 */
function migrateLevelDomain150(): void {
  const db = getDb();
  const targets = [
    {
      table: 'level_exp_defs',
      probe: 'level BETWEEN 1 AND 100',
      create: `CREATE TABLE level_exp_defs_v19 (
        level        INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 150),
        exp_required INTEGER NOT NULL CHECK (exp_required >= 0),
        exp_total    INTEGER NOT NULL CHECK (exp_total >= 0)
      );`,
      columns: 'level, exp_required, exp_total',
    },
    {
      table: 'players',
      probe: 'worldtree_level BETWEEN 1 AND 100',
      create: `CREATE TABLE players_v19 (
        id              TEXT PRIMARY KEY,
        nickname        TEXT NOT NULL,
        gender          TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        server          INTEGER NOT NULL DEFAULT 17 CHECK (server BETWEEN 1 AND 99),
        worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (worldtree_level BETWEEN 1 AND 150),
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        UNIQUE (server, nickname)
      );`,
      columns: 'id, nickname, gender, server, worldtree_level, created_at, updated_at',
    },
    {
      table: 'equipment_defs',
      probe: 'required_level BETWEEN 1 AND 100',
      create: `CREATE TABLE equipment_defs_v19 (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        slot       TEXT NOT NULL CHECK (slot IN ('weapon', 'crown', 'armor', 'charm', 'relic', 'crest')),
        rarity     TEXT NOT NULL CHECK (rarity IN ('rare', 'epic', 'legendary')),
        story      TEXT NOT NULL DEFAULT '',
        health     INTEGER NOT NULL DEFAULT 0,
        attack     INTEGER NOT NULL DEFAULT 0,
        defense    INTEGER NOT NULL DEFAULT 0,
        speed      INTEGER NOT NULL DEFAULT 0,
        critical   INTEGER NOT NULL DEFAULT 0,
        resistance INTEGER NOT NULL DEFAULT 0,
        required_level INTEGER NOT NULL DEFAULT 1
          CHECK (required_level BETWEEN 1 AND 150)
          REFERENCES level_exp_defs (level)
      );`,
      columns: 'id, name, slot, rarity, story, health, attack, defense, speed, critical, resistance, required_level',
    },
    {
      table: 'scene_defs',
      probe: 'unlock_worldtree_level BETWEEN 1 AND 100',
      create: `CREATE TABLE scene_defs_v19 (
        id                     TEXT PRIMARY KEY,
        name                   TEXT NOT NULL,
        type                   TEXT NOT NULL CHECK (type IN ('battle', 'idle', 'guild', 'manor', 'activity')),
        background             TEXT NOT NULL DEFAULT '',
        music                  TEXT NOT NULL DEFAULT '',
        unlock_worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (unlock_worldtree_level BETWEEN 1 AND 150),
        order_index            INTEGER NOT NULL DEFAULT 0,
        updated_at             TEXT NOT NULL
      );`,
      columns: 'id, name, type, background, music, unlock_worldtree_level, order_index, updated_at',
    },
  ];

  const pending = targets.filter(target => {
    const current = queryOne<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      target.table,
    );
    return current && current.sql.includes(target.probe);
  });
  if (!pending.length) return;

  // 重建顺序：level_exp_defs 最先（被 equipment_defs / level_stats_defs 外键引用，
  // 同名重建后引用自动恢复）；foreign_keys=OFF 下 DROP 不触发级联与悬空校验。
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    for (const target of pending) {
      db.exec(target.create);
      db.exec(`INSERT INTO ${target.table}_v19 (${target.columns}) SELECT ${target.columns} FROM ${target.table};`);
      db.exec(`DROP TABLE ${target.table};`);
      db.exec(`ALTER TABLE ${target.table}_v19 RENAME TO ${target.table};`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  const names = pending.map(target => target.table).join(' / ');
  console.log(`[migrate] v19：等级域已放开至 150（${names}）`);
}

/**
 * v20（§4.3 副属性洗练）：player_equipment 补 3 列——substat_key / substat_value / wash_count。
 * 每件至多 1 条副属性（池：暴击/抗暴/速度/生命，「命中」并入暴击口径），数值 2–6 区间重随
 * （生命按 ×100 计入面板）；wash_count 累计洗练次数，决定成本 2 万 × (1 + 0.5 × 次数)。
 * 无外键引用，普通 ADD COLUMN 即可（仿 v17 migrateProgressExpColumn 先例）。
 */
function migrateEquipmentSubstat(): void {
  const columns = queryAll<{ name: string }>("SELECT name FROM pragma_table_info('player_equipment')");
  const existing = new Set(columns.map(column => column.name));
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'substat_key', ddl: "ALTER TABLE player_equipment ADD COLUMN substat_key TEXT CHECK (substat_key IN ('critical', 'resistance', 'speed', 'health'));" },
    { name: 'substat_value', ddl: 'ALTER TABLE player_equipment ADD COLUMN substat_value INTEGER CHECK (substat_value BETWEEN 2 AND 6);' },
    { name: 'wash_count', ddl: 'ALTER TABLE player_equipment ADD COLUMN wash_count INTEGER NOT NULL DEFAULT 0;' },
  ];
  const pending = additions.filter(column => !existing.has(column.name));
  if (!pending.length) return;
  const db = getDb();
  for (const column of pending) db.exec(column.ddl);
  console.log('[migrate] v20：player_equipment 已补副属性洗练列（substat_key / substat_value / wash_count）');
}

/**
 * v21（副本体系 + 功能活动配置）：新建 dungeon_defs / feature_toggles 两表
 * （schema.sql CREATE TABLE IF NOT EXISTS 幂等完成，无需处理）；
 * stage_defs 补 dungeon_id 列（仿 v8 scene_id 先例，可空 REFERENCES 无默认值，
 * 普通事务内 ALTER 即可）。存量关卡的副本回填由 seed 幂等完成，避免迁移与种子耦合。
 */
function migrateStageDungeonId(): void {
  const current = queryOne<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stage_defs'",
  );
  if (!current || current.sql.includes('dungeon_id')) return;

  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec('ALTER TABLE stage_defs ADD COLUMN dungeon_id TEXT REFERENCES dungeon_defs (id);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  console.log('[migrate] v21：stage_defs 已补 dungeon_id 列，dungeon_defs / feature_toggles 表已建');
}

export const MIGRATIONS: Array<{ version: number; name: string; up?: () => void }> = [
  { version: 1, name: 'initial-domain-model' },
  { version: 2, name: 'equipment-level-zero-based', up: migrateEquipmentLevelToZeroBased },
  // v3 仅新增 player_save_documents 表，schema.sql 的 CREATE TABLE IF NOT EXISTS 已完成，无需 up 钩子
  { version: 3, name: 'save-documents' },
  // v4 仅新增 payment_orders 表（模拟支付网关），同上无需 up 钩子
  { version: 4, name: 'payment-orders' },
  // v5 仅新增 battle_passes 表（每日挑战次数与挑战卡），无需 up 钩子
  { version: 5, name: 'battle-charges' },
  // v6 仅新增 account_credentials 表（账号密码凭据），无需 up 钩子
  { version: 6, name: 'account-credentials' },
  // v7：战斗内容配置（vfx/skill/enemy）+ 配置域版本戳 catalog_meta，无需 up 钩子
  { version: 7, name: 'combat-content-config' },
  // v8：通用场景表 + stage_defs 补 scene_id 列（存量回填由 seed 完成）
  { version: 8, name: 'scene-definitions', up: migrateStageSceneId },
  // v9：通用物品与背包（item_defs + player_items），无需 up 钩子
  { version: 9, name: 'items-backpack' },
  // v10：运营活动（activity_defs + player_activity_progress），player_progress 旧 JSON 列只读共存
  { version: 10, name: 'activity-system' },
  // v11：GM 体系（账号/审计/封禁/个性化系统邮件），无需 up 钩子
  { version: 11, name: 'gm-operations' },
  // v12：排行榜（定义/条目/赛季快照），无需 up 钩子
  { version: 12, name: 'leaderboards' },
  // v13：运营与安全日志（op_logs + security_logs），无需 up 钩子
  { version: 13, name: 'operation-security-logs' },
  // v14：主线任务链 P0——quest_defs 扩展 metric 白名单 + ref_id 列（重建表）
  { version: 14, name: 'quest-metrics-expansion', up: migrateQuestMetricsExpansion },
  // v15：成长维度——经验表/等级表/职业表（新建）+ equipment_defs 补等级需求列 + character_defs.role 挂外键
  { version: 15, name: 'growth-dimensions', up: migrateGrowthDimensions },
  // v16：按服隔离——players 昵称唯一改为 (server, nickname)；社交/排行榜按服过滤由服务层实现
  { version: 16, name: 'server-scoped-identity', up: migrateServerScopedIdentity },
  // v17：数值核心 v2——世界树/掌灶人等级上限 30→100（players/scene_defs 重建）+ player_progress 补经验余额列
  { version: 17, name: 'numeric-core-v2', up: () => { migrateWorldtreeCap100(); migrateProgressExpColumn(); migrateEnhancementCap12(); } },
  // v18：每日任务 leaf 档——quest_defs metric 白名单加 daily_battle_wins（重建表）
  { version: 18, name: 'quest-daily-battle-metric', up: migrateQuestDailyBattleMetric },
  // v19：§2.5 100+ 级无墙延伸——等级域 100→150（level_exp_defs/players/equipment_defs/scene_defs 重建；
  //      经验曲线 1.07 闭式续接，growth_bp 100 级封顶 2.6，存量 1–100 曲线零漂移）
  { version: 19, name: 'level-domain-150', up: migrateLevelDomain150 },
  // v20：§4.3 装备副属性洗练——player_equipment 补 substat_key/substat_value/wash_count 列
  { version: 20, name: 'equipment-substat', up: migrateEquipmentSubstat },
  // v21：副本体系 + 功能活动配置——新建 dungeon_defs / feature_toggles；stage_defs 补 dungeon_id 列
  { version: 21, name: 'dungeon-feature-toggles', up: migrateStageDungeonId },
];

export type MigrationResult = { applied: number[]; skipped: number[] };

/**
 * 执行迁移。schema.sql 使用 CREATE TABLE IF NOT EXISTS，天然幂等；
 * schema_migrations 仅用于记录版本与时间，便于后续增量迁移。
 */
export function runMigrations(): MigrationResult {
  const db = getDb();
  db.exec(loadSchemaSql());

  const applied: number[] = [];
  const skipped: number[] = [];
  for (const migration of MIGRATIONS) {
    const existing = queryOne<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      migration.version,
    );
    if (existing) {
      skipped.push(migration.version);
      continue;
    }
    migration.up?.();
    execute(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      migration.version,
      migration.name,
      nowIso(),
    );
    applied.push(migration.version);
  }
  return { applied, skipped };
}

if (isMain(import.meta.url)) {
  connectDatabase();
  const result = runMigrations();
  console.log(`[migrate] 数据库：${env.databasePath}`);
  console.log(`[migrate] 新应用版本：${result.applied.join(', ') || '无'}`);
  console.log(`[migrate] 已存在版本：${result.skipped.join(', ') || '无'}`);
  closeDatabase();
}
