import { useMemo } from 'react';
import { useArchive } from '../context';
import { cityLabel, daysOf, fmtLocalDate, fmtLocalRange, placeholderFor } from '../format';
import { Icon } from '../icons';
import { tripHref } from '../router';
import { captureOffsetOf, footprintOf, memoryOf, photosOfTrip, visitsOfTrip } from '../selectors';
import { Badge, EmptyState, ErrorState, LoadingState, PageHead, Screen } from '../ui';

const ELEMENTS: readonly { glyph: string; name: string }[] = [
  { glyph: '石', name: '庭院石' },
  { glyph: '灯', name: '霓虹灯牌' },
  { glyph: '叶', name: '梧桐叶' },
  { glyph: '茶', name: '龙井茶' },
  { glyph: '竹', name: '竹椅' },
  { glyph: '票', name: '轻轨票' },
  { glyph: '贝', name: '贝壳' },
  { glyph: '冰', name: '冰晶' },
  { glyph: '香', name: '香料包' },
  { glyph: '云', name: '雪山云' },
  { glyph: '桥', name: '石桥影' },
  { glyph: '书', name: '旧书页' },
];

function elementFor(cityKey: string): { glyph: string; name: string } {
  let hash = 0;
  for (let index = 0; index < cityKey.length; index += 1) hash = (hash * 33 + cityKey.charCodeAt(index)) >>> 0;
  return ELEMENTS[hash % ELEMENTS.length] ?? { glyph: '石', name: '庭院石' };
}

export function FrogScreen() {
  const snapshot = useArchive();
  const trips = snapshot.trips;
  const latest = trips[0] ?? null;
  const latestVisits = latest ? visitsOfTrip(snapshot, latest.id) : [];
  const latestPhotos = latest ? photosOfTrip(snapshot, latest.id) : [];
  const latestMemory = latest ? memoryOf(snapshot, latest) : null;
  const habitat = latestVisits[latestVisits.length - 1] ?? null;
  const footprint = useMemo(() => footprintOf(snapshot, null), [snapshot]);
  const latestOffset = captureOffsetOf(latestPhotos);

  if (snapshot.status === 'loading') {
    return (
      <Screen name="frog">
        <LoadingState note="正在找回它记得的旅行…" />
      </Screen>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <Screen name="frog">
        <ErrorState
          icon="frog"
          title="暂时找不到它的栖息地"
          body="最近旅程的索引读取失败。旅程与记忆仍在本地，不会丢失；可以重试或去旅程档案直接打开。"
          actions={<><a className="btn btn-primary" href="#/home">返回首页</a><a className="btn btn-secondary" href="#/settings">检查存储</a></>}
          meta="FROG_HABITAT_UNAVAILABLE"
        />
      </Screen>
    );
  }

  if (!latest) {
    return (
      <Screen name="frog">
        <PageHead crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>青蛙</span></>} title="青蛙" lede="它还没有落脚的地方。" />
        <EmptyState
          icon="frog"
          title="我还没有落脚的地方"
          body="导入一次旅行的照片并确认旅程后，青蛙就会住进最近结束的那趟。它不喂食、不升级，只负责记住你最近停在哪里。"
          actions={<><a className="btn btn-primary btn-lg" href="#/import">导入照片</a><a className="btn btn-secondary btn-lg" href="#/home">返回首页</a></>}
          meta="青蛙不会生成任何用户未输入的记忆"
        />
      </Screen>
    );
  }

  return (
    <Screen name="frog">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>青蛙</span></>}
        title="青蛙"
        lede="它不是宠物，也不是游戏化养成。青蛙是一个位置锚：停在最近结束的旅程，提醒你哪里还缺一块。"
        actions={<span className="tag"><Icon name="shield" className="icon icon-xs" />本地叙事 · 不参与统计</span>}
      />

      <div className="frog-page">
        <section className="card frog-hero" aria-label="当前栖息地">
          <svg className="hero-pattern" aria-hidden="true"><use href="#i-frog" /></svg>
          <div className="kicker">
            <Badge tone="confirmed" dot>当前栖息地</Badge>
            <span className="mini-label">{fmtLocalDate(latest.timeRange.end - 1, latestOffset)} 回到</span>
          </div>
          <h2 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 650, letterSpacing: '-.02em' }}>
            {habitat?.cityRef.name ?? cityLabel(latest.cityRefs, 1)}
          </h2>
          <p className="habitat">{latest.title} · {latestVisits.length} 站 · {latestPhotos.length} 张照片</p>
          <svg className="frog-big" viewBox="0 0 120 96" aria-hidden="true"><use href="#i-frog" /></svg>
          <blockquote>{latestMemory ? `“${latestMemory.text}”` : '这趟还没有一句话记忆。打开旅程，写一句最想记住的话。'}</blockquote>
          <div className="actions">
            <a className="btn btn-primary btn-sm" href={`#/replay/${encodeURIComponent(latest.id)}`}><Icon name="play" className="icon icon-sm" />回放最近一趟</a>
            <a className="btn btn-secondary btn-sm" href={tripHref(latest.id)}>打开行程</a>
            <a className="btn btn-ghost btn-sm" href="#/gaps">看缺口</a>
          </div>
        </section>

        <section className="card elements-card" aria-label="收集到的元素">
          <div className="card-head">
            <div><h2>去过的地方，收集到的元素</h2><div className="sub">{footprint.cities.length} 座城市 · 由城市键确定性映射</div></div>
            <Badge tone="info">不参与统计</Badge>
          </div>
          <div className="element-grid">
            {footprint.cities.map((city) => {
              const element = elementFor(city.cityKey);
              return (
                <div key={city.cityKey} className={`element-card ph ${placeholderFor(city.cityKey)}`} tabIndex={0} title={`${city.name} · ${city.year} · ${element.name}`}>
                  <span className="element-icon">{element.glyph}</span>
                  <span className="element-text"><b>{element.name}</b><small>{city.name} · {city.year}</small></span>
                </div>
              );
            })}
          </div>
          <div className="elements-foot">
            <span>{footprint.cities.length} 座城市已有元素</span>
            <span>再走一趟，它就会带回来</span>
          </div>
        </section>
      </div>

      <section className="card memory-table" aria-label="它记得的旅行">
        <div className="card-head">
          <div><h2>它记得的旅行</h2><div className="sub">按最近结束排序 · {trips.length} 趟</div></div>
          <span className="badge badge-neutral">记忆只在本机</span>
        </div>
        <table>
          <thead><tr><th style={{ width: 150 }}>时间</th><th style={{ width: 150 }}>城市</th><th>一句话记忆</th><th style={{ width: 120 }} className="acts">操作</th></tr></thead>
          <tbody>
            {trips.map((trip) => {
              const memory = memoryOf(snapshot, trip);
              return (
                <tr key={trip.id}>
                  <td className="date">{fmtLocalRange(trip.timeRange, captureOffsetOf(photosOfTrip(snapshot, trip.id)))} · {daysOf(trip.timeRange)} 天</td>
                  <td>{cityLabel(trip.cityRefs, 2)}</td>
                  <td className="mem">{memory ? memory.text : <span className="muted">还没有写一句话记忆</span>}</td>
                  <td className="acts">
                    <a className="btn btn-xs btn-secondary" href={tripHref(trip.id)}>打开</a>
                    <a className="btn btn-xs btn-ghost" href={`#/replay/${encodeURIComponent(trip.id)}`}>回放</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {trips.length === 0 ? <p className="muted" style={{ padding: 14, fontSize: 12 }}>还没有旅程。</p> : null}
      </section>
    </Screen>
  );
}
