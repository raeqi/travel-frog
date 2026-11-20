import { useEffect, useRef, useState } from 'react';
import {
  journeyAway,
  journeyPhase,
  type FrogPace,
  type FrogTravelState,
} from '../../domain/frog/journey';
import type { CityRef } from '../../domain/city/city-ref';
import './frog-journey.css';

import {frogJourneyLocation} from '../../domain/frog/journey';
const PHASES = {
  resting: '在家休息',
  packing: '收拾行李',
  outbound: '去程中',
  visiting: '在目的地停留',
  returning: '回家路上',
};
const time = (at: number, fast: boolean) =>
  new Date(at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(fast ? { second: '2-digit' } : {}),
  });
function remaining(at: number, now: number, fast: boolean) {
  const seconds = Math.max(0, Math.ceil((at - now) / 1000));
  return fast
    ? `${seconds} 秒`
    : seconds < 60
      ? '不到 1 分钟'
      : seconds < 3600
        ? `约 ${Math.ceil(seconds / 60)} 分钟`
        : `约 ${(seconds / 3600).toFixed(1)} 小时`;
}
interface Props {
  readonly showChip?: boolean;
  readonly state: FrogTravelState;
  readonly home: CityRef;
  readonly now: number;
  readonly open: boolean;
  readonly onOpen: (open: boolean) => void;
  readonly onConfigure: (input: {
    enabled?: boolean;
    pace?: FrogPace;
  }) => Promise<void>;
  readonly onHome: () => void;
  readonly onEntrust: () => void;
  readonly onLetter: (id: string) => void;
  readonly error: string | null;
  readonly onRetry: () => Promise<void>;
  readonly onCancelDirection: () => Promise<void>;
}
export function FrogJourneyPanel({
  showChip = true,
  state,
  home,
  now,
  open,
  onOpen,
  onConfigure,
  onHome,
  onEntrust,
  onLetter,
  error,
  onRetry,
  onCancelDirection,
}: Props) {
  const [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  const current = state.current;
  const phase = journeyPhase(current, now);
  const away = journeyAway(current, now);
  const fast = current?.pace === 'preview';
  const until = current
    ? phase === 'resting'
      ? current.prepareAt
      : phase === 'packing'
        ? current.departAt
        : phase === 'outbound'
          ? current.arriveAt
          : phase === 'visiting'
            ? current.returnAt
            : current.homeAt
    : null;
  const activity =
    phase === 'resting'
      ? `${home.name} · ${state.enabled || current ? '在家休息' : '暂不出门'}`
      : `${current?.destination.name} · ${PHASES[phase]}`;
  const action = async (task: () => Promise<void>) => {
    setBusy(true);
    setLocalError(null);
    try {
      await task();
    } catch (failure) {
      setLocalError(
        failure instanceof Error ? failure.message : '没有保存成功，请重试',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {showChip && <button
        className="journey-chip"
        type="button"
        aria-label="蛙蛙的旅行"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        <span className="frog-sprite pose-front" aria-hidden="true" />
        <span>
          <strong>{activity}</strong>
          <small>{fast ? '加速演示' : '自主漫游 · 本机模拟'}</small>
        </span>
      </button>}
      {open && (
        <div
          className="journey-shade"
          onClick={() => onOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onOpen(false);
            }
          }}
        >
          <section
            className="journey-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journey-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="journey-title">蛙蛙自己去旅行</h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="收起蛙蛙的旅行"
                onClick={() => onOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="journey-current" role="status">
              {activity}{state.motionPausedAt!==undefined?' · 漫游已暂停':''}
            </p>
            {current && (
              <>
                <p>
                  {current.from.name} → {current.destination.name} → 家{' '}
                  <span className="journey-source">
                    {current.source === 'autonomous'
                      ? '它自己选的地方'
                      : '按你留的方向'}
                  </span>
                </p>
                <p className="journey-coordinate">模拟坐标：{frogJourneyLocation(current,home,now)?.lat.toFixed(5)}, {frogJourneyLocation(current,home,now)?.lng.toFixed(5)}。交通转场可能过海；落脚后在附近陆地漫游。</p>
                <ol className="journey-stages" aria-label="这一趟的阶段">
                  {Object.entries(PHASES).map(([key, label]) => (
                    <li
                      key={key}
                      aria-current={phase === key ? 'step' : undefined}
                    >
                      {label}
                    </li>
                  ))}
                </ol>
                <p>
                  {until !== null
                    ? `${remaining(until, now, fast)}后${phase === 'resting' ? '开始整理行李' : phase === 'packing' ? '从家出发' : phase === 'outbound' ? '抵达目的地' : phase === 'visiting' ? '踏上归途' : '到家'}`
                    : ''}
                </p>
                <dl>
                  <div>
                    <dt>出发</dt>
                    <dd>{time(current.departAt, fast)}</dd>
                  </div>
                  <div>
                    <dt>预计回家</dt>
                    <dd>{time(current.homeAt, fast)}</dd>
                  </div>
                  <div>
                    <dt>旅途来信</dt>
                    <dd>
                      {current.letterRecorded
                        ? '已经寄回'
                        : current.letterAt
                          ? '预计停留期间寄回一张'
                          : '这一趟不寄信，回来再聊'}
                    </dd>
                  </div>
                </dl>
                {current.letterRecorded && current.wishId && (
                  <button
                    type="button"
                    className="journey-primary"
                    onClick={() => {
                      onOpen(false);
                      onLetter(current.wishId!);
                    }}
                  >
                    看看这趟来信
                  </button>
                )}
              </>
            )}
            {state.direction && (
              <p className="journey-direction">
                下一趟的方向已留好：{state.direction.destination.name}
                。它会先走完眼前这一趟。
              </p>
            )}
            <div className="journey-actions">
              {(state.direction ||
                (current?.source === 'directed' && !away)) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void action(onCancelDirection)}
                >
                  撤回下一趟方向
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onOpen(false);
                  onHome();
                }}
              >
                回家看看
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpen(false);
                  onEntrust();
                }}
              >
                给下一趟留方向
              </button>
            </div>
            <fieldset disabled={busy}>
              <legend>它的旅行节奏</legend>
              <label>
                <input
                  type="checkbox"
                  checked={state.enabled}
                  onChange={(event) =>
                    void action(() =>
                      onConfigure({ enabled: event.target.checked }),
                    )
                  }
                />
                让蛙蛙自己安排旅行
              </label>
              <label>
                旅行节奏{' '}
                <select
                  aria-label="旅行节奏"
                  value={state.pace}
                  disabled={away}
                  onChange={(event) =>
                    void action(() =>
                      onConfigure({ pace: event.target.value as FrogPace }),
                    )
                  }
                >
                  <option value="natural">自然时光 · 一趟数小时</option>
                  <option value="preview">加速演示 · 一趟约一分钟</option>
                </select>
              </label>
              {away && (
                <small>
                  {state.direction
                    ? '这一趟先走完，回家后按已留方向出门。关闭自动安排不会取消你的托付，可以撤回下一趟方向。'
                    : '这一趟已经出发，节奏回来后再调。关闭自动出门会让它走完这一趟，再留在家里。'}
                </small>
              )}
              {!state.enabled && current?.source === 'directed' && !away && (
                <small>
                  自主出门已关闭；你留的这趟方向仍会走完，出发前可以撤回。
                </small>
              )}
            </fieldset>
            <p className="journey-offline">
              关闭浏览器后不后台运行、不通知；下次打开只补算已排定的这一趟。
            </p>
            <details>
              <summary>蛙蛙如何自己安排旅行？</summary>
              <p>
                它会从内置的故事目的地中挑选，避开家的城市和最近两站。路程远近影响模拟时长；有些旅行寄信，有些只在回家后留下一条旅记。你也可以给下一趟留一个方向。
              </p>
              <p>
                这是按本机时间推进的虚构旅行，来信来自离线旅记，不是实时地点、天气或真人通信。不会替你点亮真实足迹，也不会生成你的旅行照片或纪念品。
              </p>
              <p>
                重新打开后，从打开的时间安排下一趟，不会凭空补出多趟旅行。清理浏览器数据会丢失记录，不同设备不会自动同步。
              </p>
              <p>
                加速演示会明确标记，走相同的出发、停留、回家流程，不代表真实旅行耗时。
              </p>
            </details>
            {state.history.length > 0 && (
              <div className="journey-history">
                <h3>最近回家的旅记</h3>
                {state.history
                  .slice(-3)
                  .reverse()
                  .map((j) => (
                    <p key={j.id}>
                      第 {j.number} 趟 · {j.destination.name} ·{' '}
                      {j.source === 'autonomous' ? '自己选的' : '你留的方向'} ·{' '}
                      {j.pace === 'preview' ? '加速演示' : '自然时光'} · 已回家{' '}
                      {j.letterRecorded && j.wishId && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpen(false);
                            onLetter(j.wishId!);
                          }}
                        >
                          看信
                        </button>
                      )}
                    </p>
                  ))}
              </div>
            )}
            {(error || localError) && (
              <p className="journey-error" role="alert">
                {localError ?? error}{' '}
                <button type="button" onClick={() => void action(onRetry)}>
                  重试保存进度
                </button>
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
