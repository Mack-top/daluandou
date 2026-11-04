import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Eye, Flag, Heart, Lock, Pause, Play, RotateCcw, Shield, SkipForward, Sparkles, Star, Swords, Trophy } from 'lucide-react';
import { artwork, battleChargesOf, battleStages, BATTLE_PASS_COST_GEMS, catalogDungeons, catalogServerOpenDay, characterPower, characters, compactNumber, dungeonIdOf, onCatalogChanged, squadPower, starLevel, validFormation, type DungeonDef, type GameSave } from '../game-data';
import { battleRewards, damageByUnit, healthAt, MAX_BATTLE_HISTORY } from '../battle-engine';
import type { BattleRecord, Combatant } from '../battle-types';
import { GoldButton, Ornament, Rewards, Sigil, onArtworkError } from './GameUi';

const chapterCopy: Record<string, string> = {
  '1-1': '春山初醒，微光相迎。在茶庭深处，与食灵一同完成第一次试炼。',
  '2-3': '沿着飘散茶香的小径，寻找藏匿在浓雾中的巡夜灯灵。',
  '2-4': '夜雨落在古老石桥上。带上你的伙伴，点亮前方的归途。',
  '3-1': '封存已久的月下酒窖，正酝酿一场与未知力量的相遇。',
  '3-2': '钟声穿越迷雾，回荡在无人的长廊。迎接月桥守卫的挑战。',
  '4-1': '巨大的冷房结着经年不化的霜。冰髓甜魄在雾中沉睡，别吵醒它们——除非你带着火。',
  '4-2': '灶山喷吐着余烬，锅铲如林间飞鸟。灶灰小鬼的笑声沙沙作响。',
  '4-3': '无面的厨师背对着你，永远不停下的双手正在试最后一道菜。让他想起味道吧。',
  '5-1': '忘川雾上的残宴还冒着将散未散的热气。空位很多——这一次，坐下来把饭吃完。',
};

/** catalog 未下发时的离线兜底副本（与后端 seed DUNGEON_DEFS 同源，保证纯本地可玩）。 */
const FALLBACK_DUNGEONS: DungeonDef[] = [
  { id: 'dungeon-ch1', name: '月城食缘', english: 'CHAPTER I', description: '春山初醒，与食灵一同完成月桥下的第一次试炼。', order: 1, unlockLevel: 1, unlockOpenDay: 1 },
  { id: 'dungeon-ch2', name: '桂香茶语', english: 'CHAPTER II', description: '飘散茶香的小径深处，巡夜灯灵在浓雾中等待点亮。', order: 2, unlockLevel: 5, unlockOpenDay: 1 },
  { id: 'dungeon-ch3', name: '醉月星辰', english: 'CHAPTER III', description: '月下酒窖酝酿已久，钟塔回廊的守卫正等待挑战。', order: 3, unlockLevel: 15, unlockOpenDay: 2 },
  { id: 'dungeon-ch4', name: '雾隐后厨', english: 'CHAPTER IV', description: '经年不化的冷房、燃烧的灶山——无面厨师还在试最后一道菜。', order: 4, unlockLevel: 31, unlockOpenDay: 3 },
  { id: 'dungeon-final', name: '忘川之宴', english: 'FINALE', description: '忘川雾上的残宴将散未散。这一次，坐下来把饭吃完。', order: 5, unlockLevel: 60, unlockOpenDay: 5 },
  { id: 'dungeon-endless', name: '无尽回廊', english: 'ENDLESS CORRIDOR', description: '没有尽头的巡礼，每一巡都比上一巡更接近月城的秘密。', order: 6, unlockLevel: 80, unlockOpenDay: 7 },
];

export function BattlePanel({ save, onStart, onResume, onHistory, onAscend, onCreate, onBuyPass }: {
  save: GameSave;
  onStart: (stage: string, team: string[]) => void;
  onResume: () => void;
  onHistory: () => void;
  onAscend: () => void;
  onCreate: () => void;
  onBuyPass?: () => void;
}) {
  // catalog 异步到达后重渲（battleStages/副本列表为模块级数据）
  const [, setCatalogTick] = useState(0);
  useEffect(() => onCatalogChanged(() => setCatalogTick(tick => tick + 1)), []);

  const dungeons = catalogDungeons.length ? catalogDungeons : FALLBACK_DUNGEONS;
  const playerLevel = save.worldtree;
  const openDay = catalogServerOpenDay;
  const unlockedOf = (dungeon: DungeonDef) => playerLevel >= dungeon.unlockLevel && openDay >= dungeon.unlockOpenDay;
  const stagesOf = (id: string) => battleStages.filter(stage => dungeonIdOf(stage) === id);

  const [dungeonPick, setDungeonPick] = useState<string | null>(null);
  const firstUnlocked = dungeons.find(unlockedOf);
  // 当前选中副本非法（未下发/已锁定）时回退第一个已解锁副本
  const dungeon = dungeons.find(item => item.id === dungeonPick && unlockedOf(item)) ?? firstUnlocked ?? dungeons[0];
  const stages = dungeon ? stagesOf(dungeon.id) : battleStages;

  const [stagePick, setStagePick] = useState<string | null>(null);
  // 选中关卡不在当前副本（或已失效）时回退「第一个未通关关卡」
  const fallbackStageId = stages.find(stage => !save.firstClears.includes(stage.id))?.id || stages[0]?.id || '';
  const activeStageId = stages.some(stage => stage.id === stagePick) ? stagePick! : fallbackStageId;
  const stage = battleStages.find(item => item.id === activeStageId);
  const cleared = Boolean(stage) && save.firstClears.includes(stage!.id);
  const charges = battleChargesOf(save);
  const [formation, setFormation] = useState(() => validFormation(save));
  const actualTeam = validFormation(save, formation);
  const actualPower = squadPower(save, actualTeam);
  const changeTeam = (name: string) => setFormation(current => current.includes(name) ? current.filter(item => item !== name) : current.length < 3 ? [...current, name] : current);

  return <div className="expedition-panel">
    <header className="expedition-banner">
      <img src={artwork.battlefield} alt="月下茶庭的古老石桥" decoding="async"  onError={onArtworkError} />
      <div className="expedition-banner-shade" />
      <div className="expedition-banner-copy"><p className="eyebrow">{dungeon?.english || 'THE MOONLIT EXPEDITION'}</p><span className="chapter-caption">{dungeon?.name || '副本远征'}</span><h2>{stage ? stage.name : '暂无可挑战关卡'}</h2><p>{stage ? chapterCopy[stage.id] : '请等待运营开放更多副本。'}</p></div>
      <Sigil className="expedition-seal" />
    </header>
    <nav className="dungeon-grid" aria-label="副本选择">
      {dungeons.map(item => {
        const unlocked = unlockedOf(item);
        const dungeonStages = stagesOf(item.id);
        const clearedCount = dungeonStages.filter(stage => save.firstClears.includes(stage.id)).length;
        return <button key={item.id} className={`dungeon-card ${dungeon?.id === item.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`} disabled={!unlocked}
          aria-pressed={dungeon?.id === item.id}
          aria-label={`${item.name}，${unlocked ? `已解锁，${clearedCount}/${dungeonStages.length} 关通关` : `需等级 ${item.unlockLevel} 且开服 ${item.unlockOpenDay} 天解锁`}`}
          onClick={() => setDungeonPick(item.id)}>
          <small>{item.english}</small>
          <strong>{item.name}</strong>
          {unlocked
            ? <span className="dungeon-progress">{clearedCount} / {dungeonStages.length} 关</span>
            : <span className="dungeon-lock"><Lock size={11} /> Lv.{item.unlockLevel} · 开服{item.unlockOpenDay}天</span>}
        </button>;
      })}
    </nav>
    {stage && <nav className="expedition-chapters stage-list" aria-label="副本关卡">
      {stages.map(item => <button key={item.id} aria-pressed={item.id === activeStageId} className={item.id === activeStageId ? 'selected' : ''} onClick={() => setStagePick(item.id)}><small>{item.id}</small><strong>{item.name}</strong>{save.firstClears.includes(item.id) && <Check size={12} aria-label="已通关" />}</button>)}
    </nav>}
    <div className="expedition-content">
      {save.pendingBattle && <div className="pending-battle"><Flag size={20} /><div><strong>一段尚未结束的远征</strong><span>{save.pendingBattle.stageName} · 本次战斗已保存，可随时继续</span></div><button onClick={onResume}>继续远征 <ArrowRight size={15} /></button></div>}
      <div className="formation-heading"><div><p className="eyebrow">CHOOSE YOUR COMPANIONS</p><h3>与你并肩的食灵 <span>{actualTeam.length} / 3</span></h3></div><button className="text-button" onClick={onAscend}><Sparkles size={13} /> 食灵升星</button></div>
      <div className="formation-picker" aria-label="出战食灵">
        {characters.map(character => {
          const owned = save.characters.includes(character.name);
          const selected = actualTeam.includes(character.name);
          return <button key={character.name} type="button" disabled={!owned || (!selected && actualTeam.length >= 3)} aria-pressed={selected} aria-label={`${character.name}，${owned ? selected ? '已出战' : '选择出战' : '未拥有'}`} onClick={() => changeTeam(character.name)} className={`formation-spirit ${selected ? 'selected' : ''} ${!owned ? 'unowned' : ''}`}>
            <div className="formation-portrait"><img src={character.image} style={{ objectPosition: character.position }} alt="" className={selected ? 'battle-member' : ''}  onError={onArtworkError} /><span className="spirit-rarity">{character.rarity}</span><span className="formation-check">{selected ? <Check size={12} /> : owned ? '+' : <Shield size={12} />}</span></div>
            <strong>{character.name}</strong><span className="formation-stars">{Array.from({ length: owned ? starLevel(save, character.name) : 1 }, (_, i) => <Star key={i} size={8} fill="currentColor" />)}</span><small>{owned ? `${compactNumber(characterPower(save, character.name))} 战力` : '等待相遇'}</small>
          </button>;
        })}
      </div>
      <p className="formation-hint"><CircleHelp size={12} /> 选择 1 至 3 位食灵出战；星级、占星及旅者装备均影响战力。</p>
      <div className="expedition-readiness"><div><Swords size={17} /><span>队伍战力<strong>{compactNumber(actualPower)}</strong></span></div><div><Shield size={17} /><span>推荐战力<strong>{compactNumber(stage?.suggest ?? 0)}</strong></span></div><span className={actualPower >= (stage?.suggest ?? 0) ? 'ready' : 'difficult'}>{actualPower >= (stage?.suggest ?? 0) ? '准备就绪' : '有些挑战，建议先升星'}</span></div>
      <div className="expedition-charges" aria-label="今日挑战次数">
        <span>今日挑战 <strong>{charges.used}</strong> / {charges.used + charges.remaining} 次</span>
        {charges.canBuy && onBuyPass && <button className="text-button" onClick={onBuyPass}>购买挑战卡（{BATTLE_PASS_COST_GEMS} 灵晶 +1 次）</button>}
        {charges.remaining <= 0 && <span className="difficult">今日次数已用尽，明日重置</span>}
      </div>
    </div>
    {/* 操作条固定在弹框底部（不随内容滚动），打开即可见【开始远征】 */}
    <div className="expedition-footer"><div className="expedition-rewards"><span>{cleared ? '再次挑战奖励' : '首次通关奖励'}<small>{cleared ? '按首通奖励的 20% 结算' : '每关仅首次胜利领取全额'}</small></span>{stage && <Rewards items={battleRewards(save, stage.id)} small />}</div><div className="expedition-start"><GoldButton disabled={!stage || !!save.profile && (actualTeam.length === 0 || !!save.pendingBattle || charges.remaining <= 0)} onClick={() => save.profile ? onStart(activeStageId, actualTeam) : onCreate()}>{save.profile ? (charges.remaining <= 0 ? '今日次数已用尽' : <><Swords size={16} /> 开始远征</>) : '创建角色后出发'}</GoldButton><button className="battle-history-link" onClick={onHistory}><Eye size={13} /> 我的战斗回放 <ChevronRight size={13} /></button></div></div>
      <p className="expedition-disclaimer">每日免费挑战 4 次，可用挑战卡（{BATTLE_PASS_COST_GEMS} 灵晶/张）扩展，每日总上限 10 次，跨日零点重置。</p>
  </div>;
}

function EnemyPortrait({ index }: { index: number }) {
  return <svg className={`enemy-portrait enemy-${index}`} viewBox="0 0 100 120" fill="none" aria-hidden="true"><path d="M50 14 25 27 17 58 30 95 50 111 70 95 83 58 75 27Z" fill="#172338" stroke="#9a896b" /><path d="M24 38 12 12 41 28M76 38 88 12 59 28" fill="#272839" stroke="#bd9a63" /><path d="m27 46 17 8-8 10-11-7M73 46l-17 8 8 10 11-7" fill={index === 1 ? '#bda5ff' : '#f2c580'} /><path d="m50 35 6 14-6 8-6-8ZM37 82l13 9 13-9M50 66v13M30 30l20-8 20 8" stroke="#bf9d69" /><path d="M18 67 8 84l23 14M82 67l10 17-23 14" stroke="#8c7d6c" /><circle cx="50" cy="14" r="4" fill="#d2b687" /></svg>;
}

function Fighter({ unit, health, active, target, amount, healing, index }: { unit: Combatant; health: number; active: boolean; target: boolean; amount?: number; healing: boolean; index: number }) {
  const character = characters.find(item => item.name === unit.character);
  const ratio = Math.max(0, health / unit.maxHp * 100);
  return <div className={`combat-fighter ${unit.side} ${health <= 0 ? 'fallen' : ''} ${active ? 'acting' : ''} ${target ? 'targeted' : ''}`} style={{ '--fighter-index': index } as CSSProperties}>
    <span className="fighter-name">{unit.name}</span>
    <div className="fighter-frame">{character ? <img src={character.image} style={{ objectPosition: character.position }} alt={unit.name}  onError={onArtworkError} /> : <EnemyPortrait index={index} />}<div className="fighter-frame-shade" /><span className="fighter-stars">{Array.from({ length: unit.star }, (_, i) => <Star key={i} size={8} fill="currentColor" />)}</span>{health <= 0 && <span className="fallen-label">退场</span>}{target && amount !== undefined && <b className={`floating-damage ${healing ? 'heal' : ''}`} key={`${health}-${amount}`}>{healing ? '+' : '-'}{amount}</b>}</div>
    <div className="fighter-health" role="progressbar" aria-label={`${unit.name}生命`} aria-valuenow={health} aria-valuemin={0} aria-valuemax={unit.maxHp}><i style={{ width: `${ratio}%` }} /></div><small>{health.toLocaleString()} / {unit.maxHp.toLocaleString()}</small>
    <div className="fighter-shadow" />
  </div>;
}

export function CombatPanel({ record, replay, onResult, onExit }: { record: BattleRecord; replay: boolean; onResult: () => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const finished = step >= record.turns.length;
  const turn = step > 0 ? record.turns[step - 1] : null;
  const health = healthAt(record, step);
  const actor = record.units.find(unit => unit.id === turn?.actor);
  const target = record.units.find(unit => unit.id === turn?.target);
  const caption = !turn ? '月色已至，食灵就位。' : `${actor?.name}施放「${turn.skill}」，${turn.kind === 'heal' ? '为' : '对'}${target?.name}${turn.kind === 'heal' ? '恢复' : '造成'} ${turn.amount} ${turn.kind === 'heal' ? '生命' : '伤害'}${turn.critical ? '（暴击）' : ''}。`;

  useEffect(() => {
    if (!playing || finished) return;
    const timer = window.setTimeout(() => setStep(value => Math.min(value + 1, record.turns.length)), 850 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, finished, step, speed, record.turns.length]);

  useEffect(() => {
    const pauseOnHide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseOnHide);
    return () => document.removeEventListener('visibilitychange', pauseOnHide);
  }, []);

  const restart = () => { setStep(0); setPlaying(false); };
  return <div className="combat-panel">
    <header className="combat-heading"><button onClick={onExit} className="combat-back"><ArrowLeft size={16} />{replay ? '战报列表' : '暂离战场'}</button><div><p className="eyebrow">{replay ? 'MEMORIES OF THE MOONBRIDGE' : 'A COVENANT IN BATTLE'}</p><h2>{record.stageName}</h2></div><span className="combat-mode">{replay ? '回放模式' : '本地演示'}</span></header>
    <div className="combat-arena">
      <img className="arena-background" src={artwork.battlefield} alt="月色中的远征战场" decoding="async"  onError={onArtworkError} />
      <div className="arena-vignette" />
      <div className="combat-round"><span>{record.chapter} / {record.stageId}</span><strong>{finished ? '战斗结束' : `第 ${turn?.round || 1} 回合`}</strong><small>{finished ? record.win ? '胜利' : '惜败' : '命定食灵，并肩作战'}</small></div>
      <div className="combat-camp-labels"><span>你的食灵 <b>{compactNumber(record.power)}</b></span><span>迷雾守卫 <b>{compactNumber(record.enemyPower)}</b></span></div>
      <div className="combat-teams">{(['ally', 'enemy'] as const).map(side => <div key={side} className={`combat-team ${side}`}>{record.units.filter(unit => unit.side === side).map((unit, index) => <Fighter key={unit.id} unit={unit} health={health[unit.id]} index={index} active={turn?.actor === unit.id} target={turn?.target === unit.id} amount={turn?.amount} healing={turn?.kind === 'heal'} />)}</div>)}<span className="combat-versus" aria-hidden="true">VS</span></div>
      <div className="combat-action-announcement" role="status"><Sparkles size={14} /><span>{caption}</span></div>
    </div>
    <div className="playback-controls"><div className="playback-actions"><button aria-label={playing && !finished ? '暂停播放' : '播放战斗'} onClick={() => { if (finished) setStep(0); setPlaying(!playing || finished); }}>{playing && !finished ? <Pause size={17} /> : <Play size={17} />}</button><button aria-label="重新播放" onClick={restart}><RotateCcw size={15} /></button><button aria-label="逐步播放" disabled={finished} onClick={() => { setPlaying(false); setStep(value => Math.min(value + 1, record.turns.length)); }}><SkipForward size={17} /></button><button aria-label={`播放速度 ${speed} 倍`} onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}x</button></div><label className="timeline-control"><span className="sr-only">战斗进度</span><input type="range" min="0" max={record.turns.length} value={step} onChange={event => { setPlaying(false); setStep(Number(event.target.value)); }} /></label><span className="timeline-counter">{String(step).padStart(2, '0')} / {record.turns.length}</span><button className="skip-combat" onClick={() => { setPlaying(false); setStep(record.turns.length); }}>{finished ? '已结束' : '跳至结算'}<ChevronRight size={14} /></button></div>
    <div className="combat-bottom"><p>{replay ? '回放读取已保存的回合数据，不影响资源和胜场。' : '暂离或刷新后可继续本次远征，尚未领取的奖励不会丢失。'}</p><GoldButton disabled={!finished} onClick={onResult}>{finished ? replay ? '查看本次战报' : '查看战斗结算' : '战斗进行中'}</GoldButton></div>
  </div>;
}

export function ResultPanel({ record, replay, onClaim, onReplay, onContinue, onAscend }: { record: BattleRecord; replay: boolean; onClaim: () => void; onReplay: () => void; onContinue: () => void; onAscend: () => void }) {
  const settled = record.status !== 'pending';
  const stats = damageByUnit(record);
  const maxDamage = Math.max(1, ...stats.map(unit => unit.damage));
  return <div className={`battle-result-panel ${record.win ? 'victory' : 'defeat'}`}>
    <div className="result-art"><img src={artwork.battlefield} alt="" decoding="async"  onError={onArtworkError} /><div /></div>
    <div className="result-content"><p className="eyebrow">{record.win ? 'EVERY ENCOUNTER BECOMES A LEGEND' : 'EVERY JOURNEY HAS ANOTHER CHANCE'}</p><div className="victory-emblem"><Sigil />{record.win ? <Trophy /> : <Shield />}</div><h2>{record.win ? '远征凯旋' : '暂别战场'}</h2><p className="result-subtitle">{record.chapter} · {record.stageName} <span>{record.rounds} 回合</span></p><Ornament />
      {record.win ? <><p className="result-reward-label">{record.firstClear ? '首次通关赠礼' : '再次挑战赠礼'}{settled && <span><Check size={12} /> 已存入行囊</span>}</p><Rewards items={record.rewards} /></> : <div className="defeat-advice"><p>这一次，迷雾暂未散去。</p><span>提升食灵星级，或选择更适合的伙伴，再赴一场相遇。</span><button onClick={onAscend}><Sparkles size={13} /> 前往食灵升星 <ChevronRight size={13} /></button></div>}
      <section className="result-damage" aria-label="食灵战斗表现"><h3>并肩的每一份力量 <span>伤害贡献</span></h3>{stats.map((unit, index) => {
        const character = characters.find(item => item.name === unit.character)!;
        return <div className="damage-row" key={unit.id}><img src={character.image} style={{ objectPosition: character.position }} alt=""  onError={onArtworkError} /><div><strong>{unit.name}{index === 0 && <small>MVP</small>}</strong><span className="damage-bar"><i style={{ width: `${unit.damage / maxDamage * 100}%` }} /></span></div><span>{compactNumber(unit.damage)}{unit.healing > 0 && <small><Heart size={9} /> {compactNumber(unit.healing)}</small>}</span></div>;
      })}</section>
      <div className="result-actions"><GoldButton onClick={settled ? onContinue : onClaim}>{settled ? replay ? '返回战报列表' : '继续远征' : record.win ? '领取战利品' : '收录本次战报'}<ArrowRight size={16} /></GoldButton><button className="result-replay" onClick={onReplay}><Play size={13} /> 回看本次战斗</button></div>
      <p className="result-footnote">{settled ? `本地战报已保存 · ${record.id.slice(-8)}` : '每场战斗仅结算一次，回放和刷新均不会重复发奖。'}</p>
    </div>
  </div>;
}

export function RecordPanel({ save, onReplay, onStart, onResume }: { save: GameSave; onReplay: (id: string) => void; onStart: () => void; onResume: () => void }) {
  const [filter, setFilter] = useState('all');
  const records = save.battleHistory.filter(record => filter === 'all' || (filter === 'win' ? record.win : !record.win));
  return <div className="record-panel">
    <div className="archive-intro"><span>每一次并肩，都值得回望。</span><strong>{save.battleWins}<small>累计胜场</small></strong></div>
    {save.pendingBattle && <button className="archive-pending" onClick={onResume}><Flag size={16} /><span>{save.pendingBattle.stageName}<small>有一场尚未收录的远征</small></span><ArrowRight size={16} /></button>}
    <div className="simple-tabs" role="tablist" aria-label="战报筛选">{[['all', '全部战报'], ['win', '胜利'], ['loss', '惜败']].map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {records.length ? <ul className="record-list">{records.map(record => <li key={record.id}><span className={`record-result ${record.win ? 'win' : 'lose'}`}>{record.win ? '胜' : '败'}</span><span className="record-copy"><strong>{record.stageId} {record.stageName}</strong><small>{new Date(record.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {record.rounds} 回合{record.firstClear && record.win ? ' · 首通' : ''}</small></span><span className="record-power">{compactNumber(record.power)}</span><button className="outline-button small" aria-label={`回放${record.stageName}`} onClick={() => onReplay(record.id)}><Play size={11} /> 回放</button></li>)}</ul> : <div className="archive-empty"><Swords size={33} /><h3>{save.battleHistory.length ? '还没有这类战报' : '你的传奇，尚待书写'}</h3><p>{save.battleHistory.length ? '试试其他筛选，回顾已经走过的旅程。' : '完成一场远征并收录结算，即可在这里重温每个回合。'}</p><GoldButton onClick={onStart}>前往副本远征 <ArrowRight size={14} /></GoldButton></div>}
    <p className="panel-note centered">仅保存当前浏览器最近 {MAX_BATTLE_HISTORY} 场战报，回放不会再次发放奖励。</p>
  </div>;
}