import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Flame, Star } from 'lucide-react';
import {
  artwork, ascendCost, characters, chronicleEnglish, chronicleMilestones, chronicleName, compactNumber, countdownToMidnight,
  shopPacks, starLevel, tradeRates, tradeUsed, type GameSave, type Reward,
} from '../game-data';
import { GoldButton, ItemArt, Ornament, onArtworkError } from './GameUi';

function ResourceBadge({ reward }: { reward: Reward }) {
  return <span className="trade-pill"><ItemArt kind={reward.kind} className="trade-pill-art" />{reward.label}<strong>×{compactNumber(reward.amount)}</strong></span>;
}

export function TradePanel({ save, onTrade }: {
  save: GameSave;
  onTrade: (id: string, give: Reward, get: Reward) => void;
}) {
  return <div className="trade-panel">
    <div className="estate-body">
      <p className="eyebrow">EXCHANGE POST</p>
      <h3>交易坊</h3>
      <Ornament />
      <p className="estate-copy">以闲置资源兑换养成所需材料。每种兑换每日有次数限制，次日零点重置。</p>
      <ul className="trade-list">{tradeRates.map(rate => {
        const used = tradeUsed(save, rate.id);
        const left = rate.dailyLimit - used;
        const wallet = { coin: save.coins, leaf: save.leaves, gem: save.gems } as const;
        const affordable = wallet[rate.give.kind as keyof typeof wallet] >= rate.give.amount;
        const available = left > 0 && affordable;
        return <li key={rate.id}>
          <div className="trade-flow"><ResourceBadge reward={rate.give} /><ArrowRight size={15} /><ResourceBadge reward={rate.get} /></div>
          <div className="trade-side">
            <span className="trade-limit">今日剩余 <strong>{left}</strong>/{rate.dailyLimit}</span>
            <button className="claim-chip" disabled={!available} onClick={() => onTrade(rate.id, rate.give, rate.get)}>
              {!available ? (left <= 0 ? '今日已满' : '资源不足') : '兑换'}
            </button>
          </div>
        </li>;
      })}</ul>
      <p className="estate-note">持有金币 {compactNumber(save.coins)} · 精华 {save.leaves} · 灵晶 {compactNumber(save.gems)}</p>
      <p className="estate-note">汇率为界面演示，不与任何真实账户结算</p>
    </div>
  </div>;
}

export function ChroniclePanel({ save, onClaim, onGoBattle }: {
  save: GameSave;
  onClaim: (id: string) => void;
  onGoBattle: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const earned = save.chroniclePoints;

  return <div className="chronicle-panel">
    <div className="estate-body">
      <figure className="story-art-banner chronicle-art-banner"><img src={artwork.chronicle} alt="街巷食神携火狐食灵，在灯会烟火中握勺集结" loading="lazy" decoding="async"  onError={onArtworkError} /><figcaption>食神巡街 · 寻味今晚的第一锅</figcaption></figure>
      <p className="eyebrow">{chronicleEnglish}</p>
      <h3>{chronicleName}</h3>
      <Ornament />
      <p className="estate-copy">街巷深处涌起一股不肯散去的香气。完成远征并领取胜利结算，便可累积活动进度。进度与领奖记录每日零点重置。</p>
      <div className="chronicle-banner">
        <span className="chronicle-flame"><Flame size={20} /></span>
        <span className="chronicle-timer"><Clock3 size={13} /> 距活动结束 <strong>{countdownToMidnight()}</strong></span>
        <span className="chronicle-score">已击败 <strong>{earned}</strong> 名食客</span>
      </div>
      <ul className="milestone-list">{chronicleMilestones.map(milestone => {
        const reached = earned >= milestone.need;
        const claimed = save.chronicleClaimed.includes(milestone.id);
        return <li key={milestone.id} className={claimed ? 'claimed' : ''}>
          <span className="milestone-need">{milestone.label}</span>
          <span className="bp-reward">{milestone.rewards.map(reward => <ItemArt key={reward.label} kind={reward.kind} className="bp-art" />)}</span>
          <button className="claim-chip" disabled={!reached || claimed} onClick={() => onClaim(milestone.id)}>
            {claimed ? '已领取' : reached ? '领取' : `进度 ${earned}/${milestone.need}`}
          </button>
        </li>;
      })}</ul>
      <GoldButton onClick={onGoBattle}>前往灵界远征</GoldButton>
      <p className="estate-note">活动进度由本地远征胜场累积，倒计时按设备时钟计算</p>
    </div>
  </div>;
}


export function ShopPanel({ save, onBuy }: { save: GameSave; onBuy: (id: string) => void }) {
  return <div className="estate-body shop-panel">
    <figure className="story-art-banner shop-art-banner"><img src={artwork.market} alt="灵界夜市中陈列的琥珀灯火和旅途补给" loading="lazy" decoding="async"  onError={onArtworkError} /><figcaption>灵晶珍藏 · 旅途补给</figcaption></figure>
    <p className="estate-copy">以演示额度兑换灵晶与契约。确认后只写入本地存档，不会发起真实支付。</p>
    <p className="shop-balance"><ItemArt kind="gem" /> 当前灵晶 <strong>{compactNumber(save.gems)}</strong></p>
    <ul className="shop-list">{shopPacks.map(pack => {
      const bought = save.shopBought.includes(pack.id);
      return <li key={pack.id}>
        <span className="shop-gems"><ItemArt kind="gem" /><strong>{pack.gems}</strong>{pack.books > 0 && <em>+{pack.books} 契约</em>}</span>
        <span className="shop-copy"><strong>{pack.label}</strong><small>{pack.note}{bought ? ' · 已购买，可再次演示' : ''}</small></span>
        <button className="claim-chip" onClick={() => onBuy(pack.id)}>¥ {pack.price}</button>
      </li>;
    })}</ul>
    <p className="estate-note">同一礼包可重复演示购买，便于查看资源变化</p>
  </div>;
}

export function AscendPanel({ save, onAscend }: { save: GameSave; onAscend: (name: string) => void }) {
  const owned = characters.filter(character => save.characters.includes(character.name));
  return <div className="estate-body">
    <figure className="story-art-banner ascension-art-banner"><img src={artwork.ascension} alt="星辉女食灵举起发亮的水晶星辰" loading="lazy" decoding="async"  onError={onArtworkError} /><figcaption>星轨启明 · 五阶升星之约</figcaption></figure>
    <p className="estate-copy">消耗灵味原浆与食灵精华提升食灵星级。三星赠徽章，五星赠契约。</p>
    <ul className="ascend-list">{owned.map(character => {
      const star = starLevel(save, character.name);
      const maxed = star >= 5;
      const cost = ascendCost(star);
      const ready = !maxed && save.potions >= cost.potions && save.leaves >= cost.leaves;
      return <li key={character.name}>
        <img src={character.image} style={{ objectPosition: character.position }} alt=""  onError={onArtworkError} />
        <span className="ascend-copy">
          <strong>{character.name}</strong>
          <span className="ascend-stars" aria-label={`${star} 星`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} fill={i < star ? 'currentColor' : 'none'} />)}</span>
          <small>{maxed ? '已达五星' : `消耗药剂 ${compactNumber(cost.potions)} · 精华 ${cost.leaves}`}</small>
        </span>
        <button className="claim-chip" disabled={!ready} onClick={() => onAscend(character.name)}>{maxed ? '已满星' : ready ? '升星' : '资源不足'}</button>
      </li>;
    })}</ul>
    <p className="estate-note">持有药剂 {compactNumber(save.potions)} · 精华 {save.leaves}</p>
  </div>;
}
