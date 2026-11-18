import { useMemo, useState } from 'react';
import type { Wish } from '../../domain/wish/wish';
import { useArchive, useService } from '../context';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { wishSourceLabel, wishTitle } from '../labels';
import { footprintOf, gapsOf } from '../selectors';
import { Badge, LoadingState, Modal, PageHead, Screen, useAction, useToast } from '../ui';

export function GapsScreen() {
  const snapshot = useArchive();
  const service = useService();
  const { busy, run } = useAction();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Wish | null>(null);

  const footprint = useMemo(() => footprintOf(snapshot, null), [snapshot]);
  const gaps = useMemo(() => gapsOf(snapshot), [snapshot]);
  const visitedKeys = useMemo(() => new Set(footprint.cities.map((city) => city.cityKey)), [footprint.cities]);
  const wishes = useMemo(() => snapshot.wishes.slice().sort((a, b) => b.createdAt - a.createdAt), [snapshot.wishes]);
  const openWishes = wishes.filter((wish) => wish.status !== 'visited');
  const overlap = openWishes.filter((wish) => visitedKeys.has(wish.cityRef.key)).length;
  const filteredWishes = openWishes.filter((wish) => {
    const target = query.trim();
    if (target.length === 0) return true;
    return `${wish.cityRef.name}${wish.region ?? ''}${wish.notes ?? ''}`.toLocaleLowerCase('zh-CN').includes(target.toLocaleLowerCase('zh-CN'));
  });

  if (snapshot.status === 'loading') {
    return (
      <Screen name="gaps">
        <LoadingState note="正在计算缺口与同国重叠…" />
      </Screen>
    );
  }

  const add = async () => {
    if (name.trim().length === 0) {
      toast.push({ tone: 'warning', title: '请填写想去的地方' });
      return;
    }
    const ok = await run(
      async () => {
        await service.addWish({ name, region, notes });
      },
      { success: '愿望已加入本地清单' },
    );
    if (ok) {
      setAddOpen(false);
      setName('');
      setRegion('');
      setNotes('');
    }
  };

  const markVisited = async (wish: Wish) => {
    await run(
      async () => {
        await service.setWishStatus(wish.id, 'visited');
      },
      { success: '已标记为去过，并记入当年足迹' },
    );
  };

  const toggleNext = async (wish: Wish) => {
    const next = wish.status === 'next' ? 'wish' : 'next';
    await run(
      async () => {
        await service.setWishStatus(wish.id, next);
      },
      { success: next === 'next' ? '已加入下次行程' : '已移出下次行程' },
    );
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const ok = await run(
      async () => {
        await service.deleteWish(target.id);
      },
      { success: '愿望已删除' },
    );
    if (ok) setDeleteTarget(null);
  };

  return (
    <Screen name="gaps">
      <PageHead
        crumb={<><a href="#/home">首页</a><span className="sep">/</span><span>缺口清单</span></>}
        title="缺口清单"
        lede="把「想去但没去过」和「去过的城市」放在一起看。缺口只是提醒，不阻塞主流程；所有收藏与足迹都只在本地。"
        actions={
          <>
            <div className="search-field" style={{ width: 180 }}>
              <Icon name="search" />
              <input className="input" type="search" placeholder="搜索城市或愿望" aria-label="搜索缺口" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setAddOpen(true)}><Icon name="plus" />新增愿望</button>
          </>
        }
      />

      <div className="gap-summary">
        <div className="card gap-stat"><div className="ico is-pending"><Icon name="gap" /></div><div className="txt"><b>{gaps.wishesOpen + gaps.wishesNext}</b><span>想去但没去过</span></div></div>
        <div className="card gap-stat"><div className="ico"><Icon name="map" /></div><div className="txt"><b>{footprint.cityCount}</b><span>已去过的城市</span></div></div>
        <div className="card gap-stat"><div className="ico is-blue"><Icon name="route" /></div><div className="txt"><b>{overlap}</b><span>与已去城市的重合</span></div></div>
      </div>

      <div className="gap-grid">
        <section className="card" aria-label="想去但没去过">
          <div className="card-head">
            <div><h2>想去但没去过 <span className="pill-count">{filteredWishes.length}</span></h2><div className="sub">来源可追溯到手动添加或示例数据</div></div>
            <span className="badge badge-neutral">本地清单</span>
          </div>
          <div className="wish-list">
            {filteredWishes.map((wish) => (
              <article key={wish.id} className="wish-card">
                <div className={`wish-cover ph ${wish.status === 'next' ? 'ph--sea' : 'ph--night'}`}><span className="ph-art" /></div>
                <div className="wish-main">
                  <b>{wishTitle(wish)}</b>
                  <small>{wish.cityRef.countryName} · {wish.region ?? '未填写地区'}</small>
                  {wish.notes ? <span className="source-tag">{wish.notes}</span> : null}
                  <span className="source-tag">{wishSourceLabel(wish)} · {fmtDate(wish.createdAt)}</span>
                </div>
                <div className="wish-actions">
                  <button className="btn btn-xs btn-secondary" type="button" disabled={busy} onClick={() => void markVisited(wish)}>标记已去</button>
                  <button className={`btn btn-xs ${wish.status === 'next' ? 'btn-secondary' : 'btn-ghost'}`} type="button" disabled={busy} onClick={() => void toggleNext(wish)}>
                    {wish.status === 'next' ? '移出下次' : '加入下次'}
                  </button>
                  <button className="icon-btn icon-btn-sm" type="button" aria-label={`删除愿望 ${wish.cityRef.name}`} disabled={busy} onClick={() => setDeleteTarget(wish)}>
                    <Icon name="trash" className="icon icon-sm" />
                  </button>
                </div>
              </article>
            ))}
            {filteredWishes.length === 0 ? (
              <div className="empty empty-inline">
                <div className="empty-icon"><Icon name="gap" /></div>
                <h3>{query.trim().length > 0 ? '没有匹配的愿望' : '还没有想去的地方'}</h3>
                <p>{query.trim().length > 0 ? '换一个关键词试试，或新增一个愿望。' : '记录越完整，缺口提示越准确。新增一个想去的地方，它会一直留在这里。'}</p>
                <div className="empty-actions"><button className="btn btn-sm btn-primary" type="button" onClick={() => setAddOpen(true)}>新增愿望</button></div>
              </div>
            ) : null}
          </div>
          <div className="gap-foot">
            <span>想去 {openWishes.length} · 已加入下次行程 {openWishes.filter((wish) => wish.status === 'next').length}</span>
            <span>{wishes.some((wish) => wish.origin === 'demo') ? '含示例数据 · 可随时删除' : '全部本地数据'}</span>
          </div>
        </section>

        <section className="card" aria-label="去过的城市">
          <div className="card-head">
            <div><h2>去过的城市 <span className="pill-count">{footprint.cityCount}</span></h2><div className="sub">去过的城市只显示城市级位置</div></div>
            <a className="btn btn-sm btn-ghost" href="#/map">在地图上查看 <Icon name="arrow-right" className="icon icon-sm" /></a>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 520 }}>
            <table className="visited-table">
              <thead><tr><th>城市</th><th>国家</th><th style={{ width: 58 }}>年份</th><th className="col-src">来源</th><th style={{ width: 60 }} className="num">照片</th></tr></thead>
              <tbody>
                {footprint.cities.map((city) => (
                  <tr key={city.cityKey}>
                    <td className="city">{city.name}</td>
                    <td>{city.countryName}</td>
                    <td className="yr">{city.year}</td>
                    <td className="col-src">{city.sources.map((source) => (source === 'trip' ? 'Trip' : '手动')).join(' + ')}</td>
                    <td className="num">{city.photoCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {footprint.cities.length === 0 ? <p className="muted" style={{ padding: 14, fontSize: 12 }}>还没有已确认的旅程。</p> : null}
          </div>
          <div className="gap-foot">
            <span>想去 {openWishes.length} · 去过 {footprint.cityCount} · {overlap} 个重合</span>
            <span>同 CityKey 只计一次</span>
          </div>
        </section>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="新增愿望"
        sub="只保存在本机，不会上传"
        icon="plus"
        footer={<><button className="btn btn-secondary" type="button" onClick={() => setAddOpen(false)}>取消</button><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void add()}>保存愿望</button></>}
      >
        <label className="field"><span className="field-label">想去的地方</span><input className="input" value={name} maxLength={40} placeholder="例如：冰岛 · 黑沙滩" onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span className="field-label">地区（可选）</span><input className="input" value={region} maxLength={40} placeholder="例如：大西洋沿岸" onChange={(event) => setRegion(event.target.value)} /></label>
        <label className="field"><span className="field-label">备注（可选）</span><textarea className="textarea" value={notes} maxLength={200} placeholder="为什么想去，或从哪里看到的" onChange={(event) => setNotes(event.target.value)} /></label>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除这个愿望？"
        icon="trash"
        footer={<><button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)}>取消</button><button className="btn btn-danger" type="button" disabled={busy} onClick={() => void remove()}>删除</button></>}
      >
        <p style={{ fontSize: 12.5, lineHeight: '20px' }}>
          {deleteTarget ? `「${wishTitle(deleteTarget)}」会从本地愿望清单中移除。` : ''}已去过的城市记录不会改变。
        </p>
      </Modal>

      <div className="hstack mt-6" style={{ justifyContent: 'flex-end' }}>
        <Badge tone={gaps.missingLocation > 0 ? 'pending' : 'confirmed'}>
          {gaps.missingLocation > 0 ? `${gaps.missingLocation} 张照片仍缺位置` : '所有照片都有位置'}
        </Badge>
        <a className="btn btn-sm btn-ghost" href="#/fill">去补位置</a>
      </div>
    </Screen>
  );
}

export function emptyWishListHint(): string {
  return '已去过的城市会以足迹显示，愿望只做提醒。';
}
