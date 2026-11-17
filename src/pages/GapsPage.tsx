import { useMemo } from 'react';
import { useStore } from '../state';
import { navigate, routePath } from '../lib/router';
import { visitedCities } from '../lib/selectors';

export function GapsPage() {
  const { data, wishAction, notify } = useStore();
  const visited = useMemo(() => visitedCities(data), [data]);
  const visitedCountries = useMemo(() => new Set(visited.map((v) => v.country)), [visited]);
  const wishes = data.wishes;
  const nextCount = wishes.filter((w) => w.status === 'next').length;
  const overlap = wishes.filter((w) => visitedCountries.has(w.country)).length;

  const markVisited = (id: string, name: string) => {
    wishAction(id, 'visited');
    notify(`已把「${name}」标记为已去过，并加入足迹`);
  };

  const markNext = (id: string, name: string) => {
    wishAction(id, 'next');
    notify(`已把「${name}」加入下次行程`);
  };

  return (
    <section className="screen is-active" id="screen-gaps">
      <div className="gap-wrap">
        <div className="gap-head">
          <div className="page-title-block">
            <div className="title-line">
              <span className="priority p2">P2</span>
              <h1>缺口清单</h1>
              <span className="chip">地图的另一半</span>
            </div>
            <p className="page-desc">把「想去但没去过」和「去过的城市」放在一起看，缺口就是下一次出发的理由。</p>
          </div>
          <span className="hint">收藏与足迹都只在本地</span>
        </div>

        <div className="gap-grid">
          <section className="panel gap-panel" aria-label="想去但没去过">
            <div className="photos-head">
              <h2>想去但没去过 <span className="gap-count">{wishes.length}</span></h2>
              <span className="hint">来源：收藏 / 世界地图 / 分享</span>
            </div>
            <div className="wish-list">
              {wishes.map((wish) => (
                <article key={wish.id} className={`wish-card ${wish.status === 'next' ? 'is-next' : ''}`}>
                  <span className="wish-cover photo"><span className="ph-label">封面</span></span>
                  <div className="wish-main">
                    <b>{wish.name}</b>
                    <small>{wish.country} · {wish.region}</small>
                    <span className="source-tag">{wish.source}</span>
                    {wish.status === 'next' && <span className="chip" style={{ marginTop: 4 }}>已加入下次行程</span>}
                  </div>
                  <div className="wish-actions">
                    <button className="btn" type="button" onClick={() => markVisited(wish.id, wish.name)}>标记为已去</button>
                    <button
                      className="btn"
                      type="button"
                      disabled={wish.status === 'next'}
                      onClick={() => markNext(wish.id, wish.name)}
                    >
                      {wish.status === 'next' ? '已在下次行程' : '加入下次行程'}
                    </button>
                  </div>
                </article>
              ))}
              {!wishes.length && (
                <div className="cand-empty">还没有收藏想去的地方。缺口清单会一直保留在本地。</div>
              )}
            </div>
            <div className="gap-compare">
              <span>想去 {wishes.length} · 已加入下次行程 {nextCount}</span>
              <span>来源可追溯到具体收藏</span>
            </div>
          </section>

          <section className="panel gap-panel" aria-label="去过的城市">
            <div className="photos-head">
              <h2>去过的城市 <span className="gap-count">{visited.length}</span></h2>
              <button className="link-btn" type="button" onClick={() => navigate(routePath('map'))}>在地图上查看</button>
            </div>
            <ul className="visited-list">
              {visited.map((city) => (
                <li className="visited-row" key={`${city.name}-${city.country}`}>
                  <span><b>{city.name}</b><span className="vmeta">{city.country}</span></span>
                  <span className="vyear">{city.year}</span>
                  <span className="vmeta">{city.manual ? '手动标记' : '已去过'}</span>
                  <span className="vphotos">{city.photos} 张</span>
                </li>
              ))}
              {!visited.length && <li className="cand-empty" style={{ margin: 12 }}>还没有去过的城市。</li>}
            </ul>
            <div className="gap-compare">
              <span>想去 {wishes.length} · 去过 {visited.length} · {overlap} 个同国家</span>
              <span>去过的城市只显示城市级位置</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
