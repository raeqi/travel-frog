import { useMemo } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { fmtDate, fmtMonth, fmtRange } from '../lib/format';
import { latestTrip, photosOfTrip } from '../lib/selectors';
import { FrogIcon } from '../components/FrogIcon';

const CITY_ELEMENTS: Record<string, string> = {
  京都: '庭院石',
  大阪: '霓虹灯牌',
  上海: '梧桐叶',
  杭州: '龙井茶',
  成都: '竹椅',
  重庆: '轻轨票',
  青岛: '贝壳',
  哈尔滨: '冰晶',
  曼谷: '香料包',
  东京: '电车票',
  首尔: '咖啡杯',
  奈良: '鹿铃',
  巴黎: '面包屑',
  罗马: '石阶',
  新加坡: '雨树',
  伦敦: '红色电话亭',
  里斯本: '电车铃',
  皇后镇: '湖石',
  卡帕多奇亚: '热气球布',
  台北: '夜市灯',
};

export function FrogPage() {
  const { data } = useStore();
  const trips = useMemo(() => data.trips.slice().sort((a, b) => b.endAt - a.endAt), [data.trips]);
  const habitat = latestTrip(data);

  const cityMeta = useMemo(() => {
    const map = new Map<string, { element: string; month: string; year: number }>();
    for (const trip of trips) {
      const year = new Date(trip.endAt).getFullYear();
      for (const city of trip.cityNames) {
        if (!map.has(city)) {
          map.set(city, {
            element: CITY_ELEMENTS[city] ?? '小石子',
            month: fmtMonth(trip.endAt),
            year,
          });
        }
      }
    }
    return map;
  }, [trips]);

  if (!habitat) {
    return (
      <section className="screen is-active" id="screen-frog">
        <div className="frogpage-wrap">
          <div className="empty-map" style={{ display: 'flex', minHeight: 420 }}>
            <div className="empty-mark">＋</div>
            <h2>我还没有落脚的地方</h2>
            <p>导入一次旅行的照片，我就会住进最近结束的那趟。</p>
            <button className="btn btn-primary" type="button" onClick={() => navigate(routePath('import'))}>导入照片</button>
          </div>
        </div>
      </section>
    );
  }

  const habitatPhotos = photosOfTrip(data, habitat.id);
  const cityCount = cityMeta.size;

  return (
    <section className="screen is-active" id="screen-frog">
      <div className="frogpage-wrap">
        <div className="frogpage-head">
          <div className="page-title-block">
            <div className="title-line">
              <span className="priority p1">P1</span>
              <h1>青蛙</h1>
              <span className="chip">栖息中</span>
            </div>
            <p className="page-desc">它不是贴纸，它住在你的旅行里。</p>
          </div>
          <span className="hint">当前位置 · 最近结束的 Trip</span>
        </div>

        <div className="frogpage-grid">
          <section className="panel frog-hero" aria-label="青蛙当前栖息地">
            <div className="hero-top">
              <span className="chip">当前栖息地</span>
              <span className="habitat-meta">{fmtDate(habitat.endAt)} 回到</span>
            </div>
            <h2>{habitat.cityNames[0] ?? '路上'}</h2>
            <p className="habitat-meta">
              {habitat.title} · {habitat.visits.length} 站 · {habitatPhotos.length} 张照片
            </p>
            <div className="frog-big">
              <FrogIcon className="frog-svg" />
              <span className="fig-note">青蛙 · 位置锚</span>
            </div>
            <blockquote>{habitat.memory ? `“${habitat.memory}”` : '还没有写下一句话记忆。'}</blockquote>
            <div className="frog-actions">
              <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('replay', habitat.id))}>回放最近一趟</button>
              <button className="btn btn-sm" type="button" onClick={() => navigate(routePath('trip', habitat.id))}>打开行程</button>
            </div>
          </section>

          <section className="panel elements-panel" aria-label="收集到的元素">
            <div className="photos-head">
              <h2>去过的地方，收集到的元素</h2>
              <span className="hint mono">{cityMeta.size} 个城市</span>
            </div>
            <div className="element-grid">
              {Array.from(cityMeta.entries()).map(([city, meta]) => (
                <button
                  key={city}
                  className="element-card"
                  type="button"
                  onClick={() => navigate(routePath('map'))}
                  aria-label={`${city} · ${meta.element}`}
                >
                  <span className="element-icon"><span>{meta.element.slice(0, 1)}</span></span>
                  <span className="element-text">
                    <b>{meta.element}</b>
                    <small>{city} · {meta.month}</small>
                  </span>
                </button>
              ))}
              {!cityCount && <div className="hint">还没有收集到元素。</div>}
            </div>
            <div className="elements-foot">
              <span>{cityCount} 个城市 · {cityCount} 个元素</span>
              <span>再走一趟，它就会带回来</span>
            </div>
          </section>
        </div>

        <section className="panel frog-memories" aria-label="它记得的旅行">
          <div className="photos-head">
            <h2>它记得的旅行</h2>
            <span className="hint">按最近结束排序 · {trips.length} 趟</span>
          </div>
          <div className="memory-trips">
            {trips.map((trip) => (
              <div className="mt-row" key={trip.id}>
                <span className="mt-date">{fmtRange(trip.startAt, trip.endAt)}</span>
                <span className="mt-cities">{trip.cityNames.join(' / ') || '未识别地点'}</span>
                <span className="mt-memory">{trip.memory || '还没有写下一句话记忆。'}</span>
                <span className="mt-actions">
                  <button className="btn btn-xs" type="button" onClick={() => navigate(routePath('trip', trip.id))}>打开</button>
                  <button className="btn btn-xs" type="button" onClick={() => navigate(routePath('replay', trip.id))}>回放</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
