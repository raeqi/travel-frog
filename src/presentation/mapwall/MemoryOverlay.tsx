import { useState } from 'react';
import type { CSSProperties } from 'react';
import { fmtMonthDay } from '../format';
import { formattedDay, type WallPhoto, type WallTrip } from './model';

export interface MemoryOverlayProps {
  readonly trip: WallTrip;
  readonly photos: readonly WallPhoto[];
  readonly photoImage: (photo: WallPhoto) => string;
  readonly onClose: () => void;
  readonly onReplay: () => void;
  readonly onSaveMemory: (text: string) => void;
  readonly onRenameTrip: (title: string) => void;
  readonly onEditPhotoLocation?: (photoId: string) => void;
  readonly onDeleteTrip: () => void;
}

export function MemoryOverlay({
  trip,
  photos,
  photoImage,
  onClose,
  onReplay,
  onSaveMemory,
  onRenameTrip,
  onEditPhotoLocation,
  onDeleteTrip,
}: MemoryOverlayProps) {
  const [editingMemory, setEditingMemory] = useState(false);
  const [draft, setDraft] = useState(trip.memory ?? '');
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(trip.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const firstVisit = trip.visits[0];
  const photosByVisit = new Map<string, number>();
  for (const visit of trip.visits) {
    photosByVisit.set(visit.id, photos.filter((photo) => visit.photoIds.includes(photo.id)).length);
  }

  const visible = photos.slice(0, 12);
  const current = lightbox !== null ? photos[lightbox] : undefined;

  return (
    <section className="memory" aria-label="回忆">
      <button className="memory-close" type="button" aria-label="关闭回忆" onClick={onClose}>
        ×
      </button>
      <div className="memory-main">
        <header className="memory-head">
          <p className="memory-kicker">
            {trip.year} · {firstVisit?.countryName ?? ''}
          </p>
          {renaming ? (
            <form
              style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}
              onSubmit={(event) => {
                event.preventDefault();
                onRenameTrip(titleDraft);
                setRenaming(false);
              }}
            >
              <input
                value={titleDraft}
                maxLength={40}
                style={{ flex: 1, font: 'inherit', fontSize: 22, padding: '2px 6px' }}
                onChange={(event) => setTitleDraft(event.target.value)}
              />
              <button className="btn primary" type="submit">
                保存
              </button>
              <button className="btn ghost" type="button" onClick={() => setRenaming(false)}>
                取消
              </button>
            </form>
          ) : (
            <h2>{trip.title}</h2>
          )}
          <p className="memory-meta">
            {formattedDay(trip.start)} – {formattedDay(trip.end - 1)} · {trip.days} 天 · {trip.visits.length} 个站点
          </p>
        </header>
        <blockquote className="memory-line">
          {editingMemory ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSaveMemory(draft);
                setEditingMemory(false);
              }}
            >
              <textarea
                value={draft}
                maxLength={200}
                rows={3}
                style={{ width: '100%', font: 'inherit', lineHeight: 1.6, padding: 8, resize: 'vertical' }}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className="btn primary" type="submit">
                  保存
                </button>
                <button className="btn ghost" type="button" onClick={() => setEditingMemory(false)}>
                  取消
                </button>
              </div>
            </form>
          ) : (
            <>
              <p>{trip.memory || '留一句话给以后的自己。'}</p>
              <button
                className="edit-inline"
                type="button"
                title="编辑这句话"
                onClick={() => {
                  setDraft(trip.memory ?? '');
                  setEditingMemory(true);
                }}
              >
                编辑
              </button>
            </>
          )}
        </blockquote>
        <div className="photo-wall">
          {visible.map((photo, index) => (
            <div
              key={photo.id}
              className="pcell"
              style={{ '--tilt': `${((index % 5) - 2) * 0.6}deg` } as CSSProperties}
              role="button"
              tabIndex={0}
              onClick={() => setLightbox(index)}
            >
              <div className="img" style={{ backgroundImage: `url("${photoImage(photo)}")` }} />
            </div>
          ))}
        </div>
        {photos.length > 12 ? (
          <button className="more-link" type="button" onClick={() => setLightbox(12)}>
            查看全部 {photos.length} 张
          </button>
        ) : null}
      </div>
      <aside className="memory-side">
        <div className="side-block">
          <h3>站点</h3>
          <ol className="stations">
            {trip.visits.map((visit, index) => (
              <li key={visit.id}>
                <span className="idx">{index + 1}</span>
                <strong>{visit.name}</strong>
                <span>
                  {fmtMonthDay(visit.start)} · {photosByVisit.get(visit.id) ?? visit.photoIds.length} 张
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="side-block">
          <h3>这趟旅行</h3>
          <div className="side-actions">
            <button className="btn primary wide" type="button" onClick={onReplay}>
              让青蛙走一遍
            </button>
            <button
              className="btn ghost wide"
              type="button"
              onClick={() => {
                setTitleDraft(trip.title);
                setRenaming(true);
              }}
            >
              编辑旅行
            </button>
            <button
              className="link-danger"
              type="button"
              onClick={() => {
                if (confirmDelete) onDeleteTrip();
                else setConfirmDelete(true);
              }}
            >
              {confirmDelete ? '再点一次确认删除' : '删除这趟旅行'}
            </button>
          </div>
        </div>
        <p className="side-note">照片与坐标只保存在本机。删除只影响档案，原图不受影响。</p>
      </aside>

      {current ? (
        <div className="lightbox" role="dialog" aria-label="放大的旅行照片">
          <button className="lb-close" type="button" aria-label="关闭大图" onClick={() => setLightbox(null)}>
            ×
          </button>
          <button
            className="lb-nav prev"
            type="button"
            aria-label="上一张"
            onClick={() => setLightbox((index) => (index === null ? null : (index - 1 + photos.length) % photos.length))}
          >
            ‹
          </button>
          <figure>
            <img src={photoImage(current)} alt="放大的旅行照片" />
            <figcaption>
              <span>
                {formattedDay(current.capturedAt)} · {current.cityKey}
              </span>
              {onEditPhotoLocation ? (
                <button
                  className="edit-inline"
                  type="button"
                  onClick={() => onEditPhotoLocation(current.id)}
                >
                  修改位置
                </button>
              ) : null}
            </figcaption>
          </figure>
          <button
            className="lb-nav next"
            type="button"
            aria-label="下一张"
            onClick={() => setLightbox((index) => (index === null ? null : (index + 1) % photos.length))}
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
