import { useState } from 'react';
import { Check, Clock3, Lock, PackageOpen, Sparkles, Trees } from 'lucide-react';
import {
  artwork, astrologyNodes, battlePassLevel, battlePassRewards, cardPacks, characters, compactNumber, expRequiredAt, facilities,
  fundMilestones, idleAccrual, marketStockFor, privileges, worldtreeBonus, worldtreeCost, WORLD_TREE_MAX,
  type FacilityId, type GameSave, type MarketEntry,
} from '../game-data';
import { GoldButton, ItemArt, Ornament, Sigil, onArtworkError } from './GameUi';

export type EstateActions = {
  craft: (times: number) => void;
  claimIdle: () => void;
  buyMarket: (entry: MarketEntry) => void;
  unlockNode: (id: string, cost: number) => void;
  upgradeWorldtree: () => void;
  claimBp: (level: number) => void;
  openPack: (id: string, cost: number) => void;
  purchaseFund: () => void;
  claimFund: (id: string) => void;
};

function FacilityTabs({ current, onPick }: { current: FacilityId; onPick: (id: FacilityId) => void }) {
  return <div className="facility-strip" role="tablist" aria-label="庄园设施">
    {facilities.map(item => (
      <button key={item.id} role="tab" aria-selected={current === item.id} onClick={() => onPick(item.id)}>
        <strong>{item.name}</strong>
      </button>
    ))}
  </div>;
}

export function EstatePanel({ save, facility, actions, onPick }: {
  save: GameSave; facility: FacilityId; actions: EstateActions; onPick: (id: FacilityId) => void;
}) {
  const info = facilities.find(item => item.id === facility) ?? facilities[0];
  const bonus = worldtreeBonus(save);
  return <div className="estate-panel">
    <FacilityTabs current={info.id} onPick={onPick} />
    <p className="estate-bonus"><Sparkles size={13} /> 庄园产出加成 <strong>{Math.round(bonus * 100)}%</strong><span>占星 {save.astrology.length}/6 · 世界树 Lv.{save.worldtree}</span></p>

    {info.id === 'workshop' && (() => {
      const single = { coins: 22000, leaves: 24 };
      const batch = { coins: 22000 * 5, leaves: 24 * 5 };
      const canSingle = save.coins >= single.coins && save.leaves >= single.leaves;
      const canBatch = save.coins >= batch.coins && save.leaves >= batch.leaves;
      return <div className="estate-body">
        <p className="eyebrow">{info.english}</p>
        <h3>{info.name}</h3>
        <Ornament />
        <p className="estate-copy">{info.detail}{save.crafted >= 5 && ' 熟练度加成已生效：单次产出提升 10%。'}</p>
        <div className="craft-board">
          <div className="craft-ingredient"><ItemArt kind="coin" /><span>金币</span><strong>{compactNumber(single.coins)}</strong></div>
          <div className="craft-ingredient"><ItemArt kind="leaf" /><span>食灵精华</span><strong>{single.leaves}</strong></div>
          <div className="craft-arrow">→</div>
          <div className="craft-ingredient product"><ItemArt kind="potion" /><span>灵味原浆</span><strong>{compactNumber(save.crafted >= 5 ? 99000 : 90000)}</strong></div>
        </div>
        <div className="estate-actions">
          <GoldButton disabled={!canSingle} onClick={() => actions.craft(1)}>炼制一次</GoldButton>
          <GoldButton disabled={!canBatch} onClick={() => actions.craft(5)}>炼制五次</GoldButton>
        </div>
        <p className="estate-note">已炼制 {save.crafted} 次 · 持有精华 {save.leaves} · 本地演示消耗</p>
      </div>;
    })()}

    {info.id === 'timehouse' && (() => {
      const accrual = idleAccrual(save);
      const ready = accrual.coins > 0 || accrual.exp > 0;
      return <div className="estate-body">
        <p className="eyebrow">{info.english}</p>
        <h3>{info.name}</h3>
        <Ornament />
        <p className="estate-copy">{info.detail}当前上限 {accrual.capHours} 小时{accrual.capHours >= 12 ? '（世界树加成）' : ''}。</p>
        <div className="idle-dial">
          <span className="idle-ring"><Clock3 size={22} /><i>{accrual.hours.toFixed(1)}h</i></span>
          <div className="idle-balance">
            <div><ItemArt kind="coin" /><span>金币</span><strong>{compactNumber(accrual.coins)}</strong></div>
            <div><ItemArt kind="potion" /><span>灵味原浆</span><strong>{compactNumber(accrual.potions)}</strong></div>
            <div><ItemArt kind="exp" /><span>掌灶人经验</span><strong>{compactNumber(accrual.exp)}</strong></div>
          </div>
        </div>
        <GoldButton disabled={!ready} onClick={actions.claimIdle}>{ready ? '领取累积收益' : '累积中，稍后再来'}</GoldButton>
        <p className="estate-note">按本地时钟计算，最多累积 {accrual.capHours} 小时</p>
      </div>;
    })()}

    {info.id === 'market' && (() => {
      const stock = marketStockFor(save.marketDate);
      return <div className="estate-body">
        <figure className="story-art-banner market-story-banner"><img src={artwork.market} alt="灯火映照河岸夜市，食灵旅人在摊前相聚" loading="lazy" decoding="async"  onError={onArtworkError} /><figcaption>夜市开张 · 今日新鲜上架</figcaption></figure>
        <p className="eyebrow">{info.english}</p>
        <h3>{info.name}</h3>
        <Ornament />
        <p className="estate-copy">{info.detail}{save.worldtree >= 3 && ' 集市折扣已生效：商品价格九折。'}</p>
        <ul className="market-grid">{stock.map(entry => {
          const discount = save.worldtree >= 3 ? 0.9 : 1;
          const price = Math.round(entry.price * discount);
          const bought = save.marketBought.includes(entry.id);
          const affordable = save.coins >= price;
          return <li key={entry.id}>
            <ItemArt kind={entry.kind} />
            <strong>{entry.label}</strong>
            <small>×{compactNumber(entry.amount)}</small>
            <span className="market-price"><ItemArt kind="coin" className="market-coin" />{compactNumber(price)}</span>
            <button className="claim-chip" disabled={bought || !affordable} onClick={() => actions.buyMarket(entry)}>{bought ? '已兑换' : affordable ? '兑换' : '金币不足'}</button>
          </li>;
        })}</ul>
        <p className="estate-note">今日货架已于 {save.marketDate} 刷新 · 兑换结果存入旅者行囊</p>
      </div>;
    })()}

    {info.id === 'astrology' && (() => {
      const total = astrologyNodes.reduce((sum, node) => sum + node.bonus, 0);
      return <div className="estate-body">
        <p className="eyebrow">{info.english}</p>
        <h3>{info.name}</h3>
        <Ornament />
        <p className="estate-copy">{info.detail}已点亮 {save.astrology.length}/{astrologyNodes.length}，当前全队加成 {save.astrology.length * 2}%（满层 {total}%）。</p>
        <div className="star-map">{astrologyNodes.map((node, index) => {
          const unlocked = save.astrology.includes(node.id);
          const locked = index > 0 && !save.astrology.includes(astrologyNodes[index - 1].id);
          return <button key={node.id} className={unlocked ? 'lit' : ''} disabled={unlocked || locked}
            aria-pressed={unlocked} aria-label={`星图节点 ${node.name}`}
            onClick={() => actions.unlockNode(node.id, node.cost)}>
            <Sigil /><strong>{node.name}</strong>
            <small>{unlocked ? `+${node.bonus}%` : locked ? '需先点亮前一颗' : `${node.cost} 灵晶`}</small>
            {unlocked && <Check size={13} />}
            {locked && <Lock size={11} />}
          </button>;
        })}</div>
        <p className="estate-note">点亮消耗灵晶，加成永久生效 · 持有灵晶 {compactNumber(save.gems)}</p>
      </div>;
    })()}

    {info.id === 'worldtree' && (() => {
      // v17 §2.3：升级消耗 = 掌灶人经验 exp_required(L) + 金币 worldtreeCost×0.2 + 食灵精华全额
      const cost = worldtreeCost(save.worldtree);
      const coinCost = Math.round(cost.coins * 0.2);
      const expCost = expRequiredAt(save.worldtree);
      const maxed = save.worldtree >= WORLD_TREE_MAX || expCost <= 0;
      const affordable = !maxed && save.expEarned >= expCost && save.coins >= coinCost && save.leaves >= cost.leaves;
      return <div className="estate-body">
        <p className="eyebrow">{info.english}</p>
        <h3>{info.name} <span>Lv.{save.worldtree}</span></h3>
        <Ornament />
        <p className="estate-copy">{info.detail}当前产出加成 {Math.round(bonus * 100)}%，离线累积上限 {save.worldtree >= 2 ? 12 : 8} 小时。</p>
        <div className="worldtree-visual"><Trees size={46} /><span>产出加成</span><strong>+{Math.round((bonus - 1) * 100)}%</strong></div>
        {maxed ? <p className="estate-note">世界树已达最高等级，感谢你把月城照亮到最后一层。</p> : <>
          <div className="upgrade-cost">
            <span><ItemArt kind="exp" /><strong>{compactNumber(save.expEarned)} / {compactNumber(expCost)}</strong></span>
            <span><ItemArt kind="coin" /><strong>{compactNumber(coinCost)}</strong></span>
            <span><ItemArt kind="leaf" /><strong>{cost.leaves}</strong></span>
          </div>
          <GoldButton disabled={!affordable} onClick={actions.upgradeWorldtree}>{affordable ? `升级到 Lv.${save.worldtree + 1}` : '资源不足'}</GoldButton>
        </>}
        <p className="estate-note">升级需掌灶人经验、金币与食灵精华 · 持有精华 {save.leaves}</p>
      </div>;
    })()}
  </div>;
}

export function ActivityCenterPanel({ save, actions }: { save: GameSave; actions: EstateActions }) {
  const [tab, setTab] = useState('pass');
  const level = battlePassLevel(save);
  const owned = save.characters.length;

  return <div className="activity-panel">
    <div className="simple-tabs" role="tablist" aria-label="活动中心">
      {[['pass', '战令'], ['fund', '超值基金'], ['privilege', '精选特权'], ['pack', '吃货卡包']].map(([id, label]) => (
        <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
      ))}
    </div>

    {tab === 'pass' && <div className="activity-body">
      <div className="bp-head">
        <p className="eyebrow">SPIRIT BATTLE PASS</p>
        <h3>战令 <span>Lv.{level}</span></h3>
        <p className="bp-hint">完成委托、赢得远征、结识食灵都会提升战令等级。</p>
        <div className="bp-bar"><i style={{ width: `${level * 10}%` }} /><span>{level}/10</span></div>
      </div>
      <ul className="bp-list">{battlePassRewards.map((rewards, index) => {
        const target = index + 1;
        const claimed = save.bpClaimed.includes(target);
        const reachable = level >= target;
        return <li key={target} className={claimed ? 'claimed' : ''}>
          <span className="bp-level">Lv.{target}</span>
          <span className="bp-reward">{rewards.map(reward => <ItemArt key={reward.label} kind={reward.kind} className="bp-art" />)}</span>
          <span className="bp-copy">{rewards.map(reward => `${reward.label} ×${compactNumber(reward.amount)}`).join(' / ')}</span>
          <button className="claim-chip" disabled={!reachable || claimed} onClick={() => actions.claimBp(target)}>
            {claimed ? '已领取' : reachable ? '领取' : '未达成'}
          </button>
        </li>;
      })}</ul>
      <p className="estate-note">战令等级由本地演示进度推算，上限 Lv.10</p>
    </div>}

    {tab === 'fund' && <div className="activity-body">
      <div className="bp-head">
        <p className="eyebrow">VALUE FUND</p>
        <h3>超值基金</h3>
        <p className="bp-hint">激活后按图鉴收集进度返还资源，每档仅可领取一次。</p>
        {save.fundPurchased
          ? <p className="fund-state active"><Check size={14} /> 基金已激活</p>
          : <GoldButton className="fund-buy" onClick={actions.purchaseFund}>激活基金 <span className="price-inline">¥ 30</span></GoldButton>}
      </div>
      <ul className="fund-list">{fundMilestones.map(milestone => {
        const reached = owned >= milestone.need;
        const claimed = save.fundClaimed.includes(milestone.id);
        return <li key={milestone.id} className={claimed ? 'claimed' : ''}>
          <span className="fund-need">{milestone.label}</span>
          <span className="bp-reward">{milestone.rewards.map(reward => <ItemArt key={reward.label} kind={reward.kind} className="bp-art" />)}</span>
          <button className="claim-chip" disabled={!save.fundPurchased || !reached || claimed} onClick={() => actions.claimFund(milestone.id)}>
            {claimed ? '已领取' : !save.fundPurchased ? '未激活' : reached ? '领取' : `进度 ${owned}/${milestone.need}`}
          </button>
        </li>;
      })}</ul>
      <p className="estate-note">激活为本地演示操作，不产生真实扣款</p>
    </div>}

    {tab === 'privilege' && <div className="activity-body">
      <div className="bp-head">
        <p className="eyebrow">DAILY PRIVILEGES</p>
        <h3>精选特权</h3>
        <p className="bp-hint">特权状态由你的庄园养成进度决定，达成后立即生效。</p>
      </div>
      <ul className="privilege-list">{privileges.map(item => (
        <li key={item.id} className={item.active(save) ? 'active' : ''}>
          <span className="privilege-mark">{item.active(save) ? <Check size={14} /> : <Lock size={13} />}</span>
          <span className="privilege-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
          <span className="privilege-state">{item.active(save) ? '生效中' : '未达成'}</span>
        </li>
      ))}</ul>
      <p className="estate-note">特权影响本地炼制、离线收益与远征战力，不涉及真实游戏结算。</p>
    </div>}

    {tab === 'pack' && <div className="activity-body">
      <div className="bp-head">
        <p className="eyebrow">FLAVOUR CARD PACKS</p>
        <h3>吃货卡包</h3>
        <p className="bp-hint">消耗食灵契约开启卡包，优先结识尚未收录的食灵。</p>
        <p className="pack-balance"><ItemArt kind="book" /> 食灵契约 <strong>{save.books}</strong> · 已开启 {save.packsOpened} 次</p>
      </div>
      <ul className="pack-list">{cardPacks.map(pack => {
        const affordable = save.books >= pack.cost;
        return <li key={pack.id}>
          <span className="pack-icon"><PackageOpen size={24} /></span>
          <span className="pack-copy"><strong>{pack.name}</strong><small>{pack.detail}</small></span>
          <button className="claim-chip" disabled={!affordable} onClick={() => actions.openPack(pack.id, pack.cost)}>
            {affordable ? `开启 ×${pack.cost}` : '契约不足'}
          </button>
        </li>;
      })}</ul>
      <div className="pack-collection">
        <p className="mail-attachment">图鉴进度 <small>{owned} / {characters.length}</small></p>
        <div className="pack-faces">{characters.map(character => (
          <span key={character.name} className={save.characters.includes(character.name) ? 'owned' : ''}>
            <img src={character.image} style={{ objectPosition: character.position }} alt=""  onError={onArtworkError} />
            <em>{save.characters.includes(character.name) ? character.name : '未结识'}</em>
          </span>
        ))}</div>
      </div>
      <p className="estate-note">卡包为本地模拟抽取，不涉及真实付费</p>
    </div>}
  </div>;
}
