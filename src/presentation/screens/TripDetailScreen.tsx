import { useEffect, useMemo, useState } from 'react';
import { MEMORY_MAX_CODE_POINTS, countCodePoints } from '../../domain/memory/memory';
import type { Visit } from '../../domain/visit/visit';
import { useArchive, useService } from '../context';
import { cityLabel, countryLabel, daysOf, fmtLocalDate, fmtLocalTime } from '../format';
import { Icon } from '../icons';
import { navigate, useRoute } from '../router';
import { memoryOf, offsetOfTrip, photosOfTrip, tripOf, visitsOfTrip } from '../selectors';
import { Badge, EmptyState, ErrorState, LoadingState, Modal, PhotoThumb, Screen, useAction, useToast } from '../ui';
import { TripRouteMap } from '../TripRouteMap';

const PHOTO_LIMIT = 24;

export function TripDetailScreen() {
  const snapshot = useArchive();
  const service = useService();
  const route = useRoute();
  const { busy, run } = useAction();
  const toast = useToast();
  const trip = tripOf(snapshot, route.tripId);
  const [memoryText, setMemoryText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const memory = trip ? memoryOf(snapshot, trip) : null;
  const photos = useMemo(() => (trip ? photosOfTrip(snapshot, trip.id) : []), [snapshot, trip]);
  const visits = useMemo(() => (trip ? visitsOfTrip(snapshot, trip.id) : []), [snapshot, trip]);
  const offset = useMemo(() => (trip ? offsetOfTrip(snapshot, trip.id) : null), [snapshot, trip]);

  useEffect(() => {
    setMemoryText(memory?.text ?? '');
  }, [memory?.id, memory?.text, trip?.id]);

  useEffect(() => {
    setShowAllPhotos(false);
  }, [trip?.id]);

  if (snapshot.status === 'loading') {
    return (
      <Screen name="trip">
        <LoadingState note="正在读取旅程与站点…" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen name="trip">
        <ErrorState
          title="找不到这趟旅程"
          body="它可能已经被删除，或者链接指向了不存在的旅程。已有照片仍在本地档案里。"
          actions={<><a className="btn btn-primary" href="#/home">返回首页</a><a className="btn btn-secondary" href="#/import">导入照片</a></>}
          meta="TRIP_NOT_FOUND"
        />
      </Screen>
    );
  }

  const missing = photos.filter((photo) => photo.geo === null).length;
  const dayGroups = groupVisitsByDay(visits, offset);
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, PHOTO_LIMIT);
  const charCount = countCodePoints(memoryText);

  const saveMemory = async () => {
    if (charCount > MEMORY_MAX_CODE_POINTS) {
      toast.push({ tone: 'warning', title: `记忆最多 ${MEMORY_MAX_CODE_POINTS} 字` });
      return;
    }
    await run(
      async () => {
        await service.saveMemory(trip.id, memoryText);
      },
      { success: memoryText.trim().length === 0 ? '已清除这趟的记忆' : '记忆已保存' },
    );
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (title.length === 0 || title.length > 40) {
      toast.push({ tone: 'warning', title: '标题需要在 1–40 字之间' });
      return;
    }
    const ok = await run(
      async () => {
        await service.updateTrip(trip.id, { title });
      },
      { success: '标题已更新' },
    );
    if (ok) setEditOpen(false);
  };

  const remove = async () => {
    const ok = await run(
      async () => {
        await service.deleteTrip(trip.id);
      },
      { success: '旅程已删除，照片仍保留在本地' },
    );
    if (ok) navigate('home');
  };

  return (
    <Screen name="trip">
      <div className="detail-head">
        <div className="head-main">
          <div className="crumb">
            <a href="#/home">首页</a><span className="sep">/</span><span>旅程档案</span><span className="sep">/</span><span>{trip.title}</span>
          </div>
          <div className="detail-title-row">
            <h1 id="detail-title">{trip.title}</h1>
            <Badge tone="confirmed" icon="check">已确认</Badge>
            <span className="tag">{countryLabel(trip.cityRefs)} · {cityLabel(trip.cityRefs, 3)}</span>
            {trip.origin === 'demo' ? <span className="tag tag-amber">示例数据</span> : null}
          </div>
          <div className="detail-meta">
            <span className="mono">{fmtLocalDate(trip.timeRange.start, offset)} {fmtLocalTime(trip.timeRange.start, offset)} → {fmtLocalDate(trip.timeRange.end - 1, offset)} {fmtLocalTime(trip.timeRange.end - 1, offset)}</span>
            <span className="sep">·</span><span>{daysOf(trip.timeRange)} 天</span>
            <span className="sep">·</span><span>{visits.length} 站</span>
            <span className="sep">·</span><span>{photos.length} 张照片</span>
            {missing > 0 ? <><span className="sep">·</span><span className="text-pending">{missing} 张无定位</span></> : null}
          </div>
        </div>
        <div className="detail-actions">
          <button className="icon-btn" type="button" aria-label="编辑标题" onClick={() => { setTitleDraft(trip.title); setEditOpen(true); }}>
            <Icon name="edit" />
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(true)}>
            <Icon name="trash" className="icon icon-sm" />删除
          </button>
          <a className="btn btn-secondary" href={`#/fill/${encodeURIComponent(trip.id)}`}>
            <Icon name="pin" className="icon icon-sm" />补位置
          </a>
          <a className="btn btn-primary" href={`#/replay/${encodeURIComponent(trip.id)}`}>
            <Icon name="play" className="icon icon-sm" />回放这趟
          </a>
        </div>
      </div>

      {visits.length === 0 ? (
        <EmptyState
          icon="pin"
          tone="pending"
          title="没有可展示的站点"
          body={`${photos.length} 张照片都在档案里，但没有有效 GPS 或时间，无法生成站点路线。补齐位置后，站点会自动出现；不补也不会丢。`}
          actions={<><a className="btn btn-primary btn-lg" href={`#/fill/${encodeURIComponent(trip.id)}`}>去补位置</a><a className="btn btn-secondary btn-lg" href="#/map">查看地图</a></>}
          meta={`UNLOCATED_PHOTOS · ${missing} 张照片仍在档案中`}
        />
      ) : (
        <div className="detail-grid">
          <aside className="card detail-panel">
            <div className="card-head">
              <div><h2>站点 · Visit</h2><div className="sub">按时间排序 · {visits.length} 站 · 同一城市只计一次</div></div>
              <span className="pill-count">{visits.length}</span>
            </div>
            <div className="visits-scroll">
              <div className="timeline">
                {dayGroups.map((group) => (
                  <div key={group.key}>
                    <div className="timeline-day">DAY {group.dayNumber} · {group.label}</div>
                    {group.visits.map((visit) => (
                      <button key={visit.id} className="tl-item is-done" type="button" onClick={() => navigate(`replay/${encodeURIComponent(trip.id)}`)}>
                        <span className="tl-dot">{visit.sequence + 1}</span>
                        <span className="tl-body">
                          <span className="tl-time">{fmtLocalTime(visit.timeRange.start, offset)}</span>
                          <span className="tl-title"><span>{visit.displayName}</span><Badge tone="confirmed">已确认</Badge></span>
                          <span className="tl-sub"><span>{visit.cityRef.name}</span><span className="sep">·</span><span>{countVisitPhotos(snapshot, visit)} 张</span></span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {missing > 0 ? (
                  <>
                    <div className="timeline-day">未定位 · {missing} 张</div>
                    <a className="tl-item is-gap" href={`#/fill/${encodeURIComponent(trip.id)}`}>
                      <span className="tl-dot">?</span>
                      <span className="tl-body">
                        <span className="tl-title"><span>没有位置的照片</span><Badge tone="pending">待补位置</Badge></span>
                        <span className="tl-sub"><span>按天推断候选</span><span className="sep">·</span><span>不会自动写入</span></span>
                      </span>
                    </a>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-foot">
              <span className="muted" style={{ fontSize: 10.5 }}>同一 Trip 内同一城市只计 1 次</span>
              <a className="btn btn-xs btn-secondary" href={`#/fill/${encodeURIComponent(trip.id)}`}>补位置</a>
            </div>
          </aside>

          <section className="card detail-panel" aria-label="路线轨迹">
            <div className="card-head">
              <div><h2>路线轨迹</h2><div className="sub">按站点真实坐标投影 · 离线渲染</div></div>
              <div className="hstack"><Badge tone="confirmed">离线地图</Badge></div>
            </div>
            <div className="map-stage">
              <TripRouteMap visits={visits} ariaLabel={`${trip.title} 的站点路线，共 ${visits.length} 站`} />
              <div className="detail-map-caption">
                <span className="mono">{visits.length}</span> 站 · {cityLabel(trip.cityRefs, 3)} · 等距圆柱投影
              </div>
            </div>
            <div className="card-foot">
              <span className="hstack" style={{ fontSize: 10.5, color: 'var(--color-text-secondary)' }}>
                <span className="legend-line" />{cityLabel(trip.cityRefs, 3)}
              </span>
              <span className="muted" style={{ fontSize: 10.5 }}>地图不请求第三方瓦片</span>
            </div>
          </section>

          <aside className="detail-side">
            <section className="card photo-panel" aria-label="照片流">
              <div className="card-head">
                <div><h2>照片流</h2><div className="sub">{photos.length} 张 · 全部在本地</div></div>
                {photos.length > PHOTO_LIMIT ? (
                  <button className="btn btn-xs btn-ghost" type="button" onClick={() => setShowAllPhotos(!showAllPhotos)}>
                    {showAllPhotos ? '收起' : `全部 ${photos.length} 张`}
                  </button>
                ) : null}
              </div>
              <div className="ph-grid">
                {visiblePhotos.map((photo) => (
                  <PhotoThumb key={photo.id} photo={photo} label={fmtLocalDate(photo.capturedAt, photo.captureOffsetMinutes).slice(5)} />
                ))}
                {photos.length === 0 ? <div className="muted" style={{ padding: 12, fontSize: 12 }}>这趟旅程还没有照片。</div> : null}
              </div>
            </section>

            <section className="card memory-card" aria-label="一句话记忆">
              <div className="card-head">
                <div><h2>一句话记忆</h2><div className="sub">最多 {MEMORY_MAX_CODE_POINTS} 字 · 会出现在回放里</div></div>
                <Badge tone={memory ? 'confirmed' : 'neutral'}>{memory ? '已保存' : '未填写'}</Badge>
              </div>
              <div className="card-body">
                <label className="sr-only" htmlFor="memoryInput">一句话记忆</label>
                <textarea
                  className="textarea"
                  id="memoryInput"
                  maxLength={MEMORY_MAX_CODE_POINTS}
                  placeholder="写一句这趟旅行最想记住的话…"
                  value={memoryText}
                  onChange={(event) => setMemoryText(event.target.value)}
                />
                <div className="foot">
                  <span className="char-count">{charCount} / {MEMORY_MAX_CODE_POINTS}</span>
                  <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={() => void saveMemory()}>保存修改</button>
                </div>
                {missing > 0 ? (
                  <div className="unlocated-box mt-3">
                    <Icon name="pin" className="icon icon-sm" />
                    <span>还有 {missing} 张照片没有位置。补齐后，它们会出现在对应日期的路线里；不补也不会丢。</span>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      )}

      <div className="hstack mt-6" style={{ justifyContent: 'flex-end' }}>
        <a className="btn btn-ghost" href="#/home"><Icon name="arrow-left" className="icon icon-sm" />返回旅程档案</a>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑旅程标题"
        icon="edit"
        footer={<><button className="btn btn-secondary" type="button" onClick={() => setEditOpen(false)}>取消</button><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void saveTitle()}>保存</button></>}
      >
        <label className="field">
          <span className="field-label">标题（1–40 字）</span>
          <input className="input" value={titleDraft} maxLength={40} onChange={(event) => setTitleDraft(event.target.value)} />
        </label>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="删除这趟旅程？"
        sub="照片不会被删除，会回到未归属状态"
        icon="trash"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(false)}>取消</button>
            <button className="btn btn-danger" type="button" disabled={busy} onClick={() => void remove()}>删除旅程</button>
          </>
        }
      >
        <p style={{ fontSize: 12.5, lineHeight: '20px' }}>
          站点、记忆与这趟旅程的索引会被删除；{photos.length} 张照片的元数据保留在本机，可以重新导入或确认。
        </p>
      </Modal>
    </Screen>
  );
}

function countVisitPhotos(snapshot: ReturnType<typeof useArchive>, visit: Visit): number {
  return snapshot.photos.filter((photo) => photo.visitId === visit.id).length;
}

function groupVisitsByDay(visits: readonly Visit[], offset: number | null): { key: string; label: string; dayNumber: number; visits: Visit[] }[] {
  const groups: { key: string; label: string; dayNumber: number; visits: Visit[] }[] = [];
  for (const visit of visits) {
    const key = fmtLocalDate(visit.timeRange.start, offset);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: key.slice(5), dayNumber: groups.length + 1, visits: [] };
      groups.push(group);
    }
    group.visits.push(visit);
  }
  return groups;
}
