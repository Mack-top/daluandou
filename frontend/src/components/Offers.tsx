import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, Hourglass, LockKeyhole, Sparkles, Star } from 'lucide-react';
import { artwork, compactNumber, contractRewards, countdownFromHours, dailyRewards, dailyTiers, elapsedDays, firstRewards, levelRewards, sevenRewards, type GameSave, type OfferName, type Reward } from '../game-data';
import { GoldButton, ItemArt, Ornament, Rewards, onArtworkError } from './GameUi';

export type Purchase = { kind: Exclude<OfferName, 'seven'> | 'fund' | 'shop'; price: number; label: string; rewards: Reward[]; packId?: string };

type Props = {
  offer: OfferName;
  save: GameSave;
  onNavigate: (name: OfferName) => void;
  onPurchase: (purchase: Purchase) => void;
  onClaimDaily: (tier: number) => void;
  onClaimSeven: (day: number) => void;
  onClaimFirst: (day: number) => void;
  onClaimExtra: () => void;
  onCreate: () => void;
};

const themes = { contract: 'gold', level: 'gold', first: 'blue', daily: 'green', seven: 'coral' };
const images = { contract: artwork.contract, level: artwork.level, first: artwork.first, daily: artwork.lobby, seven: artwork.seven };
const title = { contract: '契约特惠', level: '等级礼包', first: '首充赠礼', daily: '每日充值', seven: '七日之约' };
const english = { contract: 'THE GOLDEN COVENANT', level: 'A GIFT FOR YOUR JOURNEY', first: 'THE FIRST ENCOUNTER', daily: 'A LITTLE GIFT, EVERY DAY', seven: 'SEVEN DAYS OF WONDER' };

export default function Offers({ offer, save, onNavigate, onPurchase, onClaimDaily, onClaimSeven, onClaimFirst, onClaimExtra, onCreate }: Props) {
  const [firstDay, setFirstDay] = useState(1);
  const [firstTab, setFirstTab] = useState('new');
  const [dailyIndex, setDailyIndex] = useState(1);
  const [sevenDay, setSevenDay] = useState(Math.min(7, elapsedDays(save.profile?.createdAt)));
  const [sevenTab, setSevenTab] = useState('login');
  const [, setTick] = useState(0);
  const purchased = save.purchases.includes(offer);
  const loginDays = Math.min(7, elapsedDays(save.profile?.createdAt));
  const tier = dailyTiers[dailyIndex];

  // 限时节气只使用本地时钟，刷新后按当天重新计算。
  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className={`offer-layout offer-${themes[offer]} offer-${offer}`}>
    <div className="offer-art"><img decoding="async" src={images[offer]} alt={offer === 'daily' ? '青团与翡翠茶庭' : `${title[offer]}主题食灵插画`}  onError={onArtworkError} /><div className="offer-art-shade" /></div>
    <div className="offer-art-caption"><span>SSR</span><div className="character-stars">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill="currentColor" strokeWidth={0} />)}</div></div>
    <section className="offer-content">
      <p className="eyebrow">{english[offer]}</p>
      <h2>{title[offer]}</h2>
      <Ornament />

      {(offer === 'contract' || offer === 'level') && <>
        {offer === 'level' && <p className="offer-bubble"><Sparkles size={13} /> 主角升级啦！咖喱为你献上超值礼包！</p>}
        <p className="offer-kicker">{offer === 'contract' ? '初入灵界，赴一场金色之约' : '每一步成长，都值得被珍藏'}</p>
        <div className="offer-value"><strong>{offer === 'contract' ? '1688' : '1888'}<small>%</small></strong><span>超值返利</span></div>
        <p className="offer-description">{offer === 'contract' ? '唤醒你的命定食灵，让冒险从此不再孤单。' : '咖喱为你献上成长礼遇，向更远的世界进发。'}</p>
        <Rewards items={offer === 'contract' ? contractRewards : levelRewards} />
        <p className="offer-countdown"><Clock3 size={13} /> <strong>永久有效</strong><span>每位旅者限购 1 次</span></p>
        <GoldButton disabled={purchased} onClick={() => onPurchase({ kind: offer, price: offer === 'contract' ? 18 : 6, label: title[offer], rewards: offer === 'contract' ? contractRewards : levelRewards })}>
          {purchased ? <><Check size={20} /> 已领取礼遇</> : <><span className="currency-sign">¥</span> {offer === 'contract' ? '18' : '6'} <span className="purchase-caption">解锁礼遇</span></>}
        </GoldButton>
        <p className="demo-notice">本地演示，不会产生真实扣款</p>
        <div className="offer-tabs" role="tablist" aria-label="开服礼包">
          <button role="tab" aria-selected={offer === 'contract'} onClick={() => onNavigate('contract')}>契约特惠</button>
          <button role="tab" aria-selected={offer === 'level'} onClick={() => onNavigate('level')}>等级礼包</button>
        </div>
      </>}

      {offer === 'first' && <>
        <p className="offer-kicker">蓝纹奶酪<span className="text-dot" />星夜的咏叹</p>
        <p className="offer-tags"><span>官方力荐</span><span>核心输出</span><span>无忧养成至毕业</span></p>
        <div className="first-feature"><span>首次充值</span><strong>6<small>元</small></strong><span>结识五星食灵</span></div>
        <p className="offer-description">冰蓝星辉，为你的冒险而闪耀。</p>
        {firstTab === 'new' ? <>
          <div className="day-tabs" role="tablist" aria-label="首充奖励天数">{[1, 2, 3].map(day => <button key={day} role="tab" aria-selected={firstDay === day} onClick={() => setFirstDay(day)}>第 {day} 天领取{save.firstClaimed.includes(day) && <Check size={12} />}</button>)}</div>
          <Rewards items={firstRewards[firstDay - 1]} />
          {purchased ? <GoldButton disabled={save.firstClaimed.includes(firstDay) || firstDay > elapsedDays(save.firstPurchasedAt)} onClick={() => onClaimFirst(firstDay)}>{save.firstClaimed.includes(firstDay) ? '今日赠礼已领取' : firstDay > elapsedDays(save.firstPurchasedAt) ? '即将解锁' : '领取今日赠礼'}</GoldButton> : <GoldButton onClick={() => onPurchase({ kind: 'first', price: 6, label: '首充赠礼', rewards: firstRewards[0] })}>解锁首充礼遇 <span className="price-inline">¥ 6</span></GoldButton>}
          <p className="daily-progress">已累计充值 <strong>{purchased ? 6 : 0}</strong> / 6 元</p>
        </> : <>
          <p className="offer-summary">累计三日可获得</p>
          <div className="first-total">
            {firstRewards.flat().map((reward, index) => <div key={`${reward.label}-${index}`} className="first-total-row">
              <ItemArt kind={reward.kind} className="first-total-art" />
              <span>{reward.label}</span>
              <strong>+{compactNumber(reward.amount)}</strong>
            </div>)}
          </div>
          <p className="demo-notice">以上为三日赠礼合计，按天逐日发放</p>
        </>}
        <p className="demo-notice">本地演示，无真实支付</p>
        <div className="offer-tabs" role="tablist" aria-label="首充礼包类型">
          <button role="tab" aria-selected={firstTab === 'new'} onClick={() => setFirstTab('new')}>萌新首充</button>
          <button role="tab" aria-selected={firstTab === 'luxury'} onClick={() => setFirstTab('luxury')}>豪华赠礼</button>
        </div>
        <p className="offer-footnote"><Sparkles size={14} /> 核心群攻食灵，陪伴你的每一场冒险</p>
      </>}

      {offer === 'daily' && <>
        <span className="offer-ribbon">总价值 60 元</span>
        <p className="offer-kicker">每日小确幸，与你常相伴</p>
        <div className="daily-feature"><span>{save.dailyPaid >= tier ? '今日充值已达' : '今日还需充值'}</span><strong>{Math.max(0, tier - save.dailyPaid) || tier}<small>元</small></strong></div>
        <div className="tier-picker"><button aria-label="上一档奖励" onClick={() => setDailyIndex((dailyIndex + 2) % 3)}><ChevronLeft size={22} /></button><span>{tier} 元档位奖励</span><button aria-label="下一档奖励" onClick={() => setDailyIndex((dailyIndex + 1) % 3)}><ChevronRight size={22} /></button></div>
        <Rewards items={dailyRewards[dailyIndex]} />
        <div className="tier-dots">{dailyTiers.map((amount, i) => <button key={amount} className={i === dailyIndex ? 'active' : ''} aria-label={`${amount}元奖励档位`} aria-pressed={i === dailyIndex} onClick={() => setDailyIndex(i)} />)}</div>
        <GoldButton disabled={save.dailyClaimed.includes(tier)} onClick={() => save.dailyPaid >= tier ? onClaimDaily(tier) : onPurchase({ kind: 'daily', price: tier - save.dailyPaid, label: '每日充值', rewards: [] })}>
          {save.dailyClaimed.includes(tier) ? '本档奖励已领取' : save.dailyPaid >= tier ? '领取今日奖励' : '前往演示充值'}
        </GoldButton>
        <p className="daily-progress">今日累计充值 <strong>{save.dailyPaid}</strong> / {tier} 元</p>
        <p className="demo-notice">本地演示，无真实支付 · 奖励每日重置</p>
      </>}

      {offer === 'seven' && <>
        <p className="offer-kicker">累计登录，邂逅命定食灵</p>
        <p className="seven-highlight">次日结识 <strong>冬阴功</strong><span>七日相伴，惊喜不止</span></p>
        <div className="seven-days" aria-label="七日奖励预览">{sevenRewards.map((rewards, i) => <button key={i} className={`${sevenDay === i + 1 ? 'selected' : ''} ${save.sevenClaimed.includes(i + 1) ? 'claimed' : ''}`} onClick={() => setSevenDay(i + 1)} aria-pressed={sevenDay === i + 1} aria-label={`第${i + 1}天奖励`}><span>第 {i + 1} 天</span><ItemArt kind={rewards[0].kind} image={rewards[0].image} />{save.sevenClaimed.includes(i + 1) && <Check className="day-check" size={18} />}{i + 1 > loginDays && <LockKeyhole className="day-lock" size={11} />}</button>)}</div>
        <div className="offer-tabs seven-tabs" role="tablist" aria-label="七日活动类型"><button role="tab" aria-selected={sevenTab === 'login'} onClick={() => setSevenTab('login')}>七日登录</button><button role="tab" aria-selected={sevenTab === 'extra'} onClick={() => setSevenTab('extra')}>限时追加</button></div>
        <Rewards items={sevenTab === 'login' ? sevenRewards[sevenDay - 1] : [{ kind: 'chest', amount: 1, label: '冒险补给箱' }, { kind: 'gem', amount: 100, label: '灵晶' }]} small />
        {!save.profile ? <GoldButton onClick={onCreate}>创建角色后领取</GoldButton> : sevenTab === 'login' ? <GoldButton disabled={save.sevenClaimed.includes(sevenDay) || sevenDay > loginDays} onClick={() => onClaimSeven(sevenDay)}>{save.sevenClaimed.includes(sevenDay) ? '本日奖励已领取' : sevenDay > loginDays ? '即将解锁' : '领取登录赠礼'}</GoldButton> : <GoldButton disabled={save.extraClaimed || save.sevenClaimed.length < 1} onClick={onClaimExtra}>{save.extraClaimed ? '追加礼遇已领取' : save.sevenClaimed.length < 1 ? '领取登录奖励后解锁' : '领取追加礼遇'}</GoldButton>}
        <p className="seven-remaining"><Hourglass size={13} /> 剩余时间 <strong>{countdownFromHours(24 * (8 - loginDays))}</strong></p>
        <p className="demo-notice">已登录 {save.profile ? loginDays : 0} 天 · 奖励保存在当前浏览器 · 点击遮罩处关闭</p>
      </>}
    </section>
  </div>;
}