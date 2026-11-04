import { useId, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, CircleHelp, Gift, Hammer, Package, ShieldCheck, Sparkles, Swords, Trash2 } from 'lucide-react';
import { artwork, characterBattleStats, compactNumber, squadPower, type GameSave } from '../game-data';
import {
  enhancementCost, equipmentBonuses, equipmentDefinition, equipmentPower, equipmentScore, equipmentSlots, equipmentStats,
  equipBestItems, formatStat, formatSubstat, MAX_ENHANCEMENT, MAX_EQUIPMENT, rarities, reforgeCost, REFORGE_UNLOCK_LEVEL,
  salvageValue, STARTER_CHESTS, statLabels, wornEquipment,
  type EquipmentInstance, type EquipmentSlot, type EquipmentStats,
} from '../equipment';
import { GoldButton, ItemArt, Ornament, Rewards, Sigil, onArtworkError } from './GameUi';
import '../equipment.css';

export type BagLocation = { tab: 'resources' | 'chests' | 'equipment'; slot?: EquipmentSlot; itemId?: string };
export type EquipmentActions = {
  onEquip: (id: string) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onAutoEquip: () => void;
  onEnhance: (id: string, level: number) => void;
  onReforge: (id: string) => void;
  onSalvage: (id: string) => void;
  onOpenChests: (count: number) => void;
  onStarter: () => void;
  onCreate: () => void;
};

export function EquipmentArt({ slot, className = '' }: { slot: EquipmentSlot; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`equipment-art ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-gold`} x1="20" y1="10" x2="75" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#fff5cb" /><stop offset=".46" stopColor="#ddbc79" /><stop offset="1" stopColor="#93704a" /></linearGradient><linearGradient id={`${id}-jade`} x1="25" y1="20" x2="65" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#c4efdf" /><stop offset=".5" stopColor="#79acaf" /><stop offset="1" stopColor="#33596e" /></linearGradient><linearGradient id={`${id}-steel`} x1="25" y1="15" x2="70" y2="85" gradientUnits="userSpaceOnUse"><stop stopColor="#f0f6ee" /><stop offset=".5" stopColor="#a9bdc8" /><stop offset="1" stopColor="#55617b" /></linearGradient></defs>
    {slot === 'weapon' && <g transform="rotate(37 50 50)"><path d="m50 6 10 18-3 40H43l-3-40Z" fill={`url(#${id}-steel)`} stroke="#f7e3b8" strokeWidth="1.5" /><path d="M50 9v52l7-37Z" fill="#edf5ec" opacity=".65" /><path d="m30 59 20 5 20-5-5 11-15-1-15 1Z" fill={`url(#${id}-gold)`} stroke="#efdcb2" /><path d="M45 70h10v19H45Z" fill="#405a63" stroke="#d1b277" /><path d="m45 74 10 4m-10 2 10 4" stroke="#c0a678" /><path d="m50 87 6 5-6 5-6-5Z" fill={`url(#${id}-gold)`} /><path d="m50 60 5 5-5 6-5-6Z" fill="#78b8b9" stroke="#f1d8a5" /></g>}
    {slot === 'crown' && <><path d="m17 30 16 14L50 20l17 24 16-14-7 42H24Z" fill={`url(#${id}-gold)`} stroke="#e8d6aa" strokeWidth="1.5" /><path d="m27 36 6 19 17-24 17 24 6-19-7 31H34Z" fill="#2f5262" /><path d="M23 65h54v11H23Z" fill={`url(#${id}-gold)`} stroke="#f9e4ae" /><path d="m50 48 7 9-7 10-7-10Z" fill={`url(#${id}-jade)`} stroke="#f7e5b6" /><circle cx="17" cy="29" r="4" fill="#e9d7aa" /><circle cx="83" cy="29" r="4" fill="#e9d7aa" /><circle cx="50" cy="18" r="4" fill="#f4dfaf" /><path d="M30 72h40" stroke="#92724b" strokeWidth="1.5" /></>}
    {slot === 'armor' && <><path d="m31 18 19 9 19-9 18 18-15 16-5 33H33l-5-33-15-16Z" fill={`url(#${id}-steel)`} stroke="#e5d1a5" strokeWidth="1.5" /><path d="m35 19 15 17 15-17-4 34H39Z" fill="#345966" stroke="#d9b77b" /><path d="m29 37 21 8 21-8-6 43H35Z" fill={`url(#${id}-jade)`} stroke="#e5c88f" /><path d="m50 42 9 14-9 12-9-12Z" fill={`url(#${id}-gold)`} /><path d="M50 68v17M33 73h34M19 36l12-8m50 8-12-8" stroke="#efdebd" strokeWidth="2" /><path d="M33 84h34" stroke="#bf985e" strokeWidth="4" /></>}
    {slot === 'charm' && <><path d="M27 14c-17 36 4 37 23 52 19-15 40-16 23-52" stroke={`url(#${id}-gold)`} strokeWidth="4" /><path d="M28 15c-11 30 2 33 22 48 20-15 33-18 22-48" stroke="#f9ebc4" /><path d="m50 53 17 20-17 23-17-23Z" fill={`url(#${id}-gold)`} stroke="#eedcb3" /><path d="m50 60 10 13-10 15-10-15Z" fill={`url(#${id}-jade)`} stroke="#eff5da" /><path d="M50 62v23l9-12Z" fill="#dfefdc" opacity=".6" /><circle cx="50" cy="51" r="4" fill="#d3b276" /></>}
    {slot === 'relic' && <><path d="M31 43h39l-5 32-16 10-15-10Z" fill={`url(#${id}-jade)`} stroke="#e7c995" strokeWidth="1.5" /><path d="M70 47h9c11 0 6 20-11 20" stroke={`url(#${id}-gold)`} strokeWidth="5" /><ellipse cx="50" cy="43" rx="20" ry="6" fill="#293b4d" stroke="#ecd6a8" strokeWidth="2" /><ellipse cx="50" cy="83" rx="26" ry="5" fill={`url(#${id}-gold)`} /><path d="M36 49h27M49 53l6 10-6 9-6-9Z" stroke="#ede3b5" strokeWidth="2" /><path d="M43 31c-10-10 11-10 3-20M57 31c-9-10 10-10 4-20" stroke="#bcd7cc" strokeWidth="2" strokeLinecap="round" opacity=".8" /></>}
    {slot === 'crest' && <><path d="m50 10 11 17 21 3-9 21 5 21-22 2-6 17-12-17-19-4 8-19-8-23 22-2Z" fill={`url(#${id}-steel)`} stroke="#ebd6a7" strokeWidth="1.5" /><path d="m50 24 22 13-5 26-17 17-18-17-4-26Z" fill="#33566a" stroke="#e1be83" strokeWidth="2" /><path d="m50 34 9 15 14 4-17 7-6 15-5-16-17-6 16-5Z" fill={`url(#${id}-gold)`} /><path d="m50 43 6 10-6 10-6-10Z" fill={`url(#${id}-jade)`} /><path d="m22 76 9 15 8-16m39 1-9 15-8-16" fill="#b59559" /></>}
  </svg>;
}

function GearTile({ save, item, selected, onSelect }: { save: GameSave; item: EquipmentInstance; selected: boolean; onSelect: () => void }) {
  const definition = equipmentDefinition(item);
  const worn = wornEquipment(save, definition.slot);
  const isEquipped = worn?.id === item.id;
  const upgrade = !isEquipped && equipmentScore(item) > (worn ? equipmentScore(worn) : 0);
  return <button type="button" aria-label={`查看${definition.name}${item.level ? `，强化${item.level}级` : ''}`} aria-pressed={selected} className={`gear-tile gear-${definition.rarity} ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className="gear-tile-top"><small>{rarities[definition.rarity].english}</small>{item.level > 0 && <b>+{item.level}</b>}</span>
    <EquipmentArt slot={definition.slot} />
    <strong>{definition.name}</strong><span className="gear-tile-score">{equipmentScore(item)} <small>战力</small></span>
    {isEquipped && <span className="gear-worn"><Check size={10} /> 已穿戴</span>}{upgrade && <span className="gear-upgrade" aria-label="比当前装备更强"><ArrowUp size={13} /></span>}
  </button>;
}

function GearDetail({ save, item, actions }: { save: GameSave; item: EquipmentInstance; actions: EquipmentActions }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const definition = equipmentDefinition(item);
  const stats = equipmentStats(item);
  const current = wornEquipment(save, definition.slot);
  const currentStats = current ? equipmentStats(current) : undefined;
  const equipped = current?.id === item.id;
  const difference = equipmentScore(item) - (current ? equipmentScore(current) : 0);
  const cost = enhancementCost(item);
  const maxed = item.level >= MAX_ENHANCEMENT;
  const canEnhance = !!save.profile && !maxed && save.coins >= cost.coins && save.leaves >= cost.leaves;
  const nextScore = equipmentScore({ ...item, level: Math.min(MAX_ENHANCEMENT, item.level + 1) });
  const keys = (Object.keys(stats) as (keyof EquipmentStats)[]).filter(key => stats[key] > 0 || (currentStats?.[key] ?? 0) > 0);
  return <section className={`gear-detail gear-${definition.rarity}`} aria-label="装备详情">
    <div className="gear-detail-art"><div className="gear-orbit" /><EquipmentArt slot={definition.slot} /><span>{rarities[definition.rarity].english}</span></div>
    <p className="gear-rarity">{rarities[definition.rarity].label} / {equipmentSlots.find(slot => slot.id === definition.slot)?.name}</p>
    <h3>{definition.name}{item.level > 0 && <small>+{item.level}</small>}</h3>
    <p className="gear-story">{definition.story}</p>
    <div className="gear-comparison"><span>{equipped ? <><Check size={12} /> 当前已穿戴</> : '与当前部位对比'}</span><strong>{equipmentScore(item)}<small>战力</small></strong>{!equipped && <b className={difference >= 0 ? 'gain' : 'loss'}>{difference >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(difference)}</b>}</div>
    <dl className="gear-stat-list">{keys.map(key => {
      const diff = stats[key] - (currentStats?.[key] || 0);
      return <div key={key}><dt>{statLabels[key]}</dt><dd>+{formatStat(key, stats[key])}{!equipped && <small className={diff >= 0 ? 'gain' : 'loss'}>{diff > 0 ? '+' : ''}{formatStat(key, diff)}</small>}</dd></div>;
    })}</dl>
    <GoldButton className="gear-equip-button" disabled={!save.profile} onClick={() => equipped ? actions.onUnequip(definition.slot) : actions.onEquip(item.id)}>{equipped ? '卸下装备' : current ? '替换已装备' : '穿戴装备'}<ArrowRight size={14} /></GoldButton>
    <div className="gear-enhancement"><div><span>{maxed ? '已达到强化上限' : `强化至 +${item.level + 1}`}</span><strong>{maxed ? 'MAX' : `战力 +${nextScore - equipmentScore(item)}`}</strong></div><p>{maxed ? '愿这份守护，陪你走得更远。' : `消耗 ${compactNumber(cost.coins)} 金币 / ${cost.leaves} 食灵精华`}</p><button className="outline-button" disabled={!canEnhance} onClick={() => actions.onEnhance(item.id, item.level)}><Hammer size={12} />{maxed ? '强化已满' : canEnhance ? '强化装备' : '强化资源不足'}</button></div>
    <div className="gear-enhancement gear-reforge">
      <div>
        <span>{item.substat ? `副属性 · ${formatSubstat(item.substat)}` : '副属性 · 尚未洗练'}</span>
        <strong>{(item.washCount ?? 0) > 0 ? `已洗练 ${item.washCount} 次` : save.worldtree >= REFORGE_UNLOCK_LEVEL ? '可洗练' : `世界树 ${REFORGE_UNLOCK_LEVEL} 级解锁`}</strong>
      </div>
      <p>{save.worldtree < REFORGE_UNLOCK_LEVEL ? '掌灶人精进到更高境界后，可为装备重铸一条随机副属性。' : `消耗 ${compactNumber(reforgeCost(item.washCount ?? 0))} 金币重随副属性（暴击/抗暴/速度/生命，数值 2–6%），次数越多消耗越高。`}</p>
      <button
        className="outline-button"
        disabled={!save.profile || save.worldtree < REFORGE_UNLOCK_LEVEL || save.coins < reforgeCost(item.washCount ?? 0)}
        onClick={() => actions.onReforge(item.id)}
      ><Sparkles size={12} />{save.worldtree < REFORGE_UNLOCK_LEVEL ? '未解锁' : save.coins >= reforgeCost(item.washCount ?? 0) ? (item.substat ? '再次洗练' : '洗练副属性') : '金币不足'}</button>
    </div>
    {confirmId === item.id ? <div className="gear-salvage-confirm"><p>分解后返还 {salvageValue(item).coins.toLocaleString()} 金币{salvageValue(item).leaves > 0 ? ` / ${salvageValue(item).leaves} 食灵精华` : ''}，此操作不可撤销。</p><button onClick={() => setConfirmId(null)}>保留装备</button><button onClick={() => { actions.onSalvage(item.id); setConfirmId(null); }}>确认分解</button></div> : <button className="gear-salvage-button" disabled={equipped || !save.profile} onClick={() => setConfirmId(item.id)}><Trash2 size={11} />{equipped ? '卸下后可分解' : `分解返还 ${compactNumber(salvageValue(item).coins)} 金币`}</button>}
  </section>;
}

export function HeroPanel({ save, actions, onAscend, onBag }: { save: GameSave; actions: EquipmentActions; onAscend: () => void; onBag: (location: BagLocation) => void }) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const bonuses = equipmentBonuses(save);
  const base = characterBattleStats({ ...save, equipped: {} }, save.formation[0] || save.characters[0]);
  const stats = characterBattleStats(save, save.formation[0] || save.characters[0]);
  const item = wornEquipment(save, selectedSlot);
  const definition = item ? equipmentDefinition(item) : null;
  const selected = equipmentSlots.find(slot => slot.id === selectedSlot)!;
  const wornCount = equipmentSlots.filter(slot => !!wornEquipment(save, slot.id)).length;
  const canAutoEquip = equipBestItems(save) !== save;
  return <div className="traveler-wardrobe">
    <aside className="wardrobe-portrait"><img src={artwork.login} alt="月光中守护旅者的食灵"  onError={onArtworkError} /><div className="wardrobe-portrait-shade" /><Sigil className="wardrobe-seal" /><div className="wardrobe-identity"><p className="eyebrow">THE CHOSEN ONE</p><h2>{save.profile?.name || '命运之子'}</h2><Ornament /><span>以百味之名，赴命定之约。</span></div></aside>
    <div className="wardrobe-content"><header className="wardrobe-heading"><p className="eyebrow">EVERY JOURNEY DESERVES A LITTLE ARMOR</p><h2>旅者的行装</h2><p>把每一次相遇，化为并肩前行的力量。</p></header>
      <div className="wardrobe-power"><span><Swords size={18} /> 队伍战力<strong data-testid="hero-power">{squadPower(save).toLocaleString()}</strong></span><span>装备加成 <b>+{equipmentPower(save).toLocaleString()}</b><small>每位食灵</small></span></div>
      <div className="hero-stats wardrobe-stats" aria-label="旅者属性">{(Object.keys(stats) as (keyof EquipmentStats)[]).map(key => <div key={key}><small>{statLabels[key]}</small><strong>{formatStat(key, stats[key])}</strong><span>{bonuses[key] ? `装备 +${formatStat(key, stats[key] - base[key])}` : '基础属性'}</span></div>)}</div>
      <div className="wardrobe-section-heading"><h3>六份守护 <span>{wornCount} / 6</span></h3><button disabled={!canAutoEquip} onClick={actions.onAutoEquip}><Sparkles size={12} /> 一键最优穿戴</button></div>
      <div className="hero-slots wardrobe-slots">{equipmentSlots.map(slot => {
        const gear = wornEquipment(save, slot.id);
        const template = gear ? equipmentDefinition(gear) : null;
        return <button key={slot.id} className={`hero-slot wardrobe-slot ${selectedSlot === slot.id ? 'selected' : ''} ${template ? `gear-${template.rarity}` : 'vacant'}`} aria-pressed={selectedSlot === slot.id} aria-label={`${slot.name}，${template?.name || '未穿戴'}`} onClick={() => setSelectedSlot(slot.id)}><EquipmentArt slot={slot.id} /><span><small>{slot.name}</small><strong>{template?.name || '等待一份馈赠'}</strong></span>{gear && <b>+{gear.level}</b>}</button>;
      })}</div>
      <section className="wardrobe-selection" aria-label="当前部位装备"><div className={`selected-gear-mark ${definition ? `gear-${definition.rarity}` : ''}`}><EquipmentArt slot={selectedSlot} /></div><div><p>{selected.english} / {selected.name}</p><h3>{definition?.name || `${selected.name}尚未穿戴`}</h3><span>{item ? `${rarities[definition!.rarity].label} · 强化 +${item.level} · 装备战力 ${equipmentScore(item)}` : '打开冒险宝箱，寻找与你相配的守护。'}</span></div><button onClick={() => onBag({ tab: 'equipment', slot: selectedSlot, itemId: item?.id })}>{item ? '更换 / 强化' : '选择装备'}<ChevronRight size={13} /></button>{item && <button className="wardrobe-unequip" onClick={() => actions.onUnequip(selectedSlot)}>卸下</button>}</section>
      <div className="wardrobe-footer"><button onClick={() => onBag({ tab: 'chests' })}><Package size={13} />{save.starterEquipmentClaimed ? '前往行囊开启宝箱' : '领取免费启程行装'}<ArrowRight size={13} /></button><button onClick={onAscend}><Sparkles size={13} /> 食灵升星</button></div><p className="wardrobe-note">属性预览以首位出战食灵为基准；旅者装备加成对全部出战食灵生效。</p>
    </div>
  </div>;
}

export function BagPanel({ save, actions, location, onHero, onBattle }: { save: GameSave; actions: EquipmentActions; location: BagLocation; onHero: () => void; onBattle: () => void }) {
  const [tab, setTab] = useState(location.tab);
  const [slot, setSlot] = useState<EquipmentSlot | 'all'>(location.slot || 'all');
  const [sort, setSort] = useState('power');
  const [selectedId, setSelectedId] = useState(location.itemId || '');
  const equipment = save.equipment.filter(item => slot === 'all' || equipmentDefinition(item).slot === slot).sort((a, b) => sort === 'power' ? equipmentScore(b) - equipmentScore(a) || b.acquiredAt.localeCompare(a.acquiredAt) : b.acquiredAt.localeCompare(a.acquiredAt) || b.id.localeCompare(a.id));
  const selected = equipment.find(item => item.id === selectedId) || equipment[0];
  const drops = (save.lastChestOpening?.equipmentIds || []).flatMap(id => save.equipment.filter(item => item.id === id));
  const remaining = MAX_EQUIPMENT - save.equipment.length;
  const seeItem = (item: EquipmentInstance) => { setSlot('all'); setSelectedId(item.id); setTab('equipment'); };

  return <div className="inventory-panel">
    <div className="inventory-intro"><p>每一次冒险的馈赠，都妥善收藏于此。</p><button onClick={onHero}><ShieldCheck size={13} /> 查看旅者装备 <ChevronRight size={13} /></button></div>
    <div className="simple-tabs inventory-tabs" role="tablist" aria-label="行囊分类">{([['resources', '物资'], ['chests', '宝箱'], ['equipment', '装备']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<small>{id === 'equipment' ? save.equipment.length : id === 'chests' ? save.chests : '7'}</small></button>)}</div>
    {tab === 'resources' && <div className="inventory-resources"><Rewards items={[{ kind: 'gem', amount: save.gems, label: '灵晶' }, { kind: 'coin', amount: save.coins, label: '金币' }, { kind: 'book', amount: save.books, label: '食灵契约' }, { kind: 'leaf', amount: save.leaves, label: '食灵精华' }, { kind: 'potion', amount: save.potions, label: '灵味原浆' }, { kind: 'chest', amount: save.chests, label: '冒险宝箱' }, { kind: 'medal', amount: save.medals, label: '食灵徽章' }]} /><div className="inventory-resource-actions"><button onClick={() => setTab('chests')}><Gift size={16} /><span>{save.chests ? `${save.chests} 只冒险宝箱，等待开启` : '为旅程领取一份免费的启程补给'}<small>每只宝箱获得一件旅者装备</small></span><ArrowRight size={15} /></button></div><p className="inventory-note">物资随领取、兑换和养成实时更新，仅保存在当前浏览器。</p></div>}
    {tab === 'chests' && <div className="chest-panel">
      {!save.starterEquipmentClaimed && <div className="starter-equipment"><Gift size={23} /><div><strong>启程行装，为每位旅者准备</strong><span>免费领取 {STARTER_CHESTS} 只冒险宝箱，每个角色仅一次。</span></div><button onClick={save.profile ? actions.onStarter : actions.onCreate}>{save.profile ? '领取启程行装' : '创建角色后领取'}<ArrowRight size={13} /></button></div>}
      <div className="chest-showcase"><div className="chest-visual"><div className="chest-halo" /><ItemArt kind="chest" /><Sigil className="chest-floor-sigil" /></div><div className="chest-showcase-copy"><p className="eyebrow">LITTLE TREASURES OF YOUR JOURNEY</p><h3>封存旅途的馈赠</h3><p>每只宝箱开出一件装备，依次覆盖六个部位。<br />把微小的馈赠，变成守护伙伴的力量。</p><span>持有 <b>{save.chests}</b> 只宝箱 <i /> 装备容量 {save.equipment.length} / {MAX_EQUIPMENT}</span><div className="chest-open-actions"><GoldButton disabled={!save.profile || save.chests < 1 || remaining < 1} onClick={() => actions.onOpenChests(1)}>开启一只</GoldButton><button className="outline-button" disabled={!save.profile || save.chests < 5 || remaining < 5} onClick={() => actions.onOpenChests(5)}>开启五只</button></div></div></div>
      <p className="chest-rules"><CircleHelp size={12} />品质概率：稀有 60% / 史诗 35% / 传说 5%。仅本地模拟，不涉及付费抽取。{remaining < 5 && <strong>装备空间不足，请先分解闲置装备。</strong>}</p>
      {drops.length > 0 && <section className="chest-receipt" key={save.lastChestOpening!.id} aria-label="宝箱开启结果"><div className="chest-receipt-heading"><p><Sparkles size={13} /> 最近一次开启的馈赠</p><span>已存入装备行囊</span></div><div className="chest-drops" role="status">{drops.map(item => <GearTile key={item.id} item={item} save={save} selected={false} onSelect={() => seeItem(item)} />)}</div><button className="chest-see-equipment" onClick={() => setTab('equipment')}>前往整理装备 <ArrowRight size={13} /></button></section>}
      {save.chests === 0 && save.starterEquipmentClaimed && <button className="inventory-empty-route" onClick={onBattle}>宝箱可通过远征任务、登录赠礼和集市获得 <ChevronRight size={13} /></button>}
    </div>}
    {tab === 'equipment' && <div className="equipment-inventory"><div className="equipment-toolbar"><label><span>部位</span><select aria-label="装备部位筛选" value={slot} onChange={event => setSlot(event.target.value as EquipmentSlot | 'all')}><option value="all">全部部位</option>{equipmentSlots.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">排序</span><select aria-label="装备排序" value={sort} onChange={event => setSort(event.target.value)}><option value="power">战力优先</option><option value="newest">最近获得</option></select></label><button disabled={equipBestItems(save) === save} onClick={actions.onAutoEquip}><Sparkles size={12} /> 一键最优穿戴</button></div>
      {equipment.length > 0 ? <div className="equipment-browser"><div className="equipment-grid" aria-label="装备列表">{equipment.map(item => <GearTile key={item.id} item={item} save={save} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />)}</div>{selected && <GearDetail key={selected.id} save={save} item={selected} actions={actions} />}</div> : <div className="equipment-empty"><ShieldCheck size={36} /><h3>{save.equipment.length ? '这个部位，尚待一次相遇' : '你的第一份守护，正在路上'}</h3><p>{save.equipment.length ? '切换部位查看已有装备，或再开启一只冒险宝箱。' : '前往宝箱页领取免费启程行装，开启属于你的六份守护。'}</p><GoldButton onClick={() => { if (save.equipment.length && slot !== 'all') setSlot('all'); else setTab('chests'); }}>{save.equipment.length && slot !== 'all' ? '查看全部装备' : '前往开启宝箱'}<ArrowRight size={14} /></GoldButton></div>}
      <p className="inventory-note">已穿戴 {Object.keys(save.equipped).length} / 6 · 装备 {save.equipment.length} / {MAX_EQUIPMENT}。替换或卸下不会丢失原装备。</p>
    </div>}
  </div>;
}