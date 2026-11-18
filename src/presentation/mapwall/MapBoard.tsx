import type { CSSProperties, RefObject } from 'react';
import type { DestinationCandidate } from './candidates';
import { CityLayer, RegionLayer, WorldLayer } from './layers';
import type { LabelPlacement, PilePlacement, Rect } from './layout';
import { FrogActions, FrogBubble, FrogNode, type FrogAction, type FrogMode } from './Frog';
import { PostcardNode, type PlacedPostcard } from './Postcard';
import type { WallPhoto, WallWish } from './model';
import type { BubblePlacement } from './layout';
import { tiltFor, projectWorld, projectCity, projectRegion, type Camera, type Metrics } from './geometry';
import { useMapGestures, maxMapZoom } from './map-gestures';
import { RealPlaces } from './RealPlaces';

export interface CityPhotoMarker {
  readonly photo: WallPhoto;
  readonly x: number;
  readonly y: number;
}

export interface RoutePath {
  readonly d: string;
  readonly className: string;
}

export interface DestTagPlacement {
  readonly destination: DestinationCandidate;
  readonly x: number;
  readonly y: number;
}

export interface MapBoardProps {
  readonly boardRef: RefObject<HTMLDivElement | null>;
  readonly sheetRef: RefObject<HTMLDivElement | null>;
  readonly camera: Camera;
  readonly metrics: Metrics;
  readonly onCamera: (camera: Camera) => void;
  readonly viewBox: string;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly mode: 'world' | 'city' | 'region';
  readonly level: 'world' | 'country' | 'city' | 'region';
  readonly visitedCountries: ReadonlySet<string>;
  readonly routes: readonly RoutePath[];
  readonly piles: readonly PilePlacement[];
  readonly cityPhotos: readonly CityPhotoMarker[];
  readonly labels: readonly LabelPlacement[];
  readonly postcards: readonly PlacedPostcard[];
  readonly wishLinks: readonly string[];
  readonly frog: { readonly x: number; readonly y: number; readonly mode: FrogMode; readonly charmCount: number } | null;
  readonly frogActions: { readonly x: number; readonly y: number; readonly below: boolean } | null;
  readonly bubble: { readonly placement: BubblePlacement; readonly text: string } | null;
  readonly destTags: readonly DestTagPlacement[];
  readonly destHint: boolean;
  readonly highlightCity: string | null;
  readonly highlightWish: string | null;
  readonly fan: { readonly cityKey: string; readonly photoIds: readonly string[] } | null;
  readonly house: { readonly x: number; readonly y: number; readonly name: string } | null;
  readonly now: number;
  readonly photoImage: (photo: WallPhoto) => string;
  readonly photoById: ReadonlyMap<string, WallPhoto>;
  readonly onPileClick: (pile: PilePlacement) => void;
  readonly onPileOpen: (cityKey: string, photoIds: readonly string[]) => void;
  readonly onPhotoOpen: (photo: WallPhoto) => void;
  readonly onLabelClick: (cityKey: string) => void;
  readonly onWishClick: (wish: WallWish) => void;
  readonly onFrogClick: () => void;
  readonly onFrogAction: (action: FrogAction) => void;
  readonly onBubbleDismiss: () => void;
  readonly onDestTag: (destination: DestinationCandidate) => void;
  readonly onHouseClick: () => void;
  readonly onBackgroundClick: () => void;
}

function PileMarkers({
  piles,
  highlightCity,
  photoById,
  photoImage,
  onPileClick,
  onPileOpen,
}: Pick<MapBoardProps, 'piles' | 'highlightCity' | 'photoById' | 'photoImage' | 'onPileClick' | 'onPileOpen'>) {
  return (
    <>
      {piles.map((pile) => {
        const count = pile.photoIds.length;
        const shown = Math.min(3, count);
        const tilt = tiltFor(pile.cityKey);
        const first = photoById.get(pile.photoIds[count - 1] ?? '');
        return (
          <div
            key={pile.cityKey}
            className={`pile${highlightCity === pile.cityKey ? ' is-hl' : ''}`}
            style={{ left: `${pile.sx}px`, top: `${pile.sy}px` }}
            role="button"
            tabIndex={0}
            aria-label={`${pile.title}，${count} 张照片`}
            data-city={pile.cityKey}
            onClick={(event) => {
              event.stopPropagation();
              onPileClick(pile);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onPileOpen(pile.cityKey, pile.photoIds);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPileClick(pile);
              }
            }}
          >
            {Array.from({ length: shown }, (_, offset) => {
              const index = shown - 1 - offset;
              const photo = photoById.get(pile.photoIds[index % Math.max(1, count)] ?? '') ?? first;
              const style = {
                '--tilt': tilt,
                '--dx': `${index * 3 - 3}px`,
                '--dy': `${index * 3 - 3}px`,
                zIndex: 3 - index,
              } as CSSProperties;
              return (
                <div key={index} className="pile-card" style={style}>
                  {photo ? <div className="img" style={{ backgroundImage: `url("${photoImage(photo)}")` }} /> : <div className="img" />}
                </div>
              );
            })}
            {count > 1 ? <span className={`count${count > 99 ? ' more' : ''}`}>{count > 999 ? '999+' : count}</span> : null}
          </div>
        );
      })}
    </>
  );
}

function CityPhotoPins({
  cityPhotos,
  highlightCity,
  photoImage,
  onPhotoOpen,
}: Pick<MapBoardProps, 'cityPhotos' | 'highlightCity' | 'photoImage' | 'onPhotoOpen'>) {
  return (
    <>
      {cityPhotos.map((marker) => (
        <button
          key={marker.photo.id}
          type="button"
          className={[
            'photo',
            marker.photo.inferred ? 'is-inferred' : '',
            highlightCity === marker.photo.cityKey ? 'is-hl' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${marker.x}px`, top: `${marker.y}px`, '--tilt': tiltFor(marker.photo.id) } as CSSProperties}
          data-photo={marker.photo.id}
          data-city={marker.photo.cityKey}
          aria-label="打开照片"
          onClick={(event) => {
            event.stopPropagation();
            onPhotoOpen(marker.photo);
          }}
        >
          <span className="img" style={{ backgroundImage: `url("${photoImage(marker.photo)}")` }} />
        </button>
      ))}
    </>
  );
}

function FanCards({
  fan,
  piles,
  photoById,
  photoImage,
  onPhotoOpen,
}: Pick<MapBoardProps, 'fan' | 'piles' | 'photoById' | 'photoImage' | 'onPhotoOpen'>) {
  if (!fan) return null;
  const pile = piles.find((item) => item.cityKey === fan.cityKey);
  if (!pile) return null;
  const list = fan.photoIds.slice(0, 7);
  return (
    <>
      {list.map((photoId, index) => {
        const photo = photoById.get(photoId);
        if (!photo) return null;
        const angle = -1.2 + (index / Math.max(1, list.length - 1)) * 2.4;
        const fx = Math.cos(angle) * 74;
        const fy = Math.sin(angle) * 74 * 0.72 - 6;
        return (
          <div
            key={photoId}
            className="fan-card"
            style={{
              left: `${pile.sx}px`,
              top: `${pile.sy}px`,
              '--fx': `${fx.toFixed(0)}px`,
              '--fy': `${fy.toFixed(0)}px`,
              '--tilt': tiltFor(photo.id),
            } as CSSProperties}
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onPhotoOpen(photo);
            }}
          >
            <div className="img" style={{ backgroundImage: `url("${photoImage(photo)}")` }} />
          </div>
        );
      })}
    </>
  );
}

export function MapBoard(props: MapBoardProps) {
  useMapGestures(props.boardRef, props.camera, props.metrics, maxMapZoom(props.mode), props.onCamera);
  const project = props.mode === 'city' ? projectCity : props.mode === 'region' ? projectRegion : projectWorld;
  const {
    boardRef,
    sheetRef,
    viewBox,
    viewWidth,
    viewHeight,
    level,
    visitedCountries,
    routes,
    labels,
    postcards,
    wishLinks,
    frog,
    frogActions,
    bubble,
    destTags,
    destHint,
    highlightCity,
    highlightWish,
    fan,
    house,
    now,
    photoImage,
    photoById,
    onLabelClick,
    onWishClick,
    onFrogClick,
    onFrogAction,
    onBubbleDismiss,
    onDestTag,
    onHouseClick,
    onBackgroundClick,
  } = props;

  return (
    <div className="frame">
      <div className="board" ref={boardRef} onClick={onBackgroundClick} tabIndex={0} role="region" aria-label="旅行地图：拖动平移，滚轮缩放，触控板双指平移，捏合缩放；键盘方向键平移，加减号缩放">
        <div className="map-sheet" id="mapSheet" ref={sheetRef}>
          <WorldLayer viewBox={viewBox} visitedCountries={visitedCountries} />
          <CityLayer viewBox={viewBox} />
          <RegionLayer viewBox={viewBox} />
          <div className="map-print" aria-hidden="true">
            <span className="map-print-title">THE WORLD, KEPT AT HOME</span>
            <span className="map-print-sub">私人旅行档案 · 仅本机</span>
          </div>
        </div>

        <svg id="routeSvg" className="route-layer" viewBox={`0 0 ${viewWidth} ${viewHeight}`} aria-hidden="true">
          {routes.map((route, index) => (
            <path key={index} className={route.className} vectorEffect="non-scaling-stroke" d={route.d} />
          ))}
        </svg>

        <div className="marker-layer" id="markerLayer">
          {level === 'city' || level === 'region' ? (
            <CityPhotoPins
              cityPhotos={props.cityPhotos}
              highlightCity={highlightCity}
              photoImage={photoImage}
              onPhotoOpen={props.onPhotoOpen}
            />
          ) : (
            <PileMarkers
              piles={props.piles}
              highlightCity={highlightCity}
              photoById={photoById}
              photoImage={photoImage}
              onPileClick={props.onPileClick}
              onPileOpen={props.onPileOpen}
            />
          )}
          <FanCards fan={fan} piles={props.piles} photoById={photoById} photoImage={photoImage} onPhotoOpen={props.onPhotoOpen} />
          {house ? (
            <button
              type="button"
              className="house-marker"
              style={{ left: `${house.x}px`, top: `${house.y}px` }}
              aria-label={`回家 · ${house.name}`}
              title={`回家 · ${house.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onHouseClick();
              }}
            >
              <span className="house-roof" aria-hidden="true" />
              <span className="house-body" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="wish-layer" id="wishLayer">
          {wishLinks.length > 0 ? (
            <svg className="wish-links" viewBox={`0 0 ${viewWidth} ${viewHeight}`} aria-hidden="true">
              {wishLinks.map((path, index) => (
                <path key={index} className="wish-link" d={path} />
              ))}
            </svg>
          ) : null}
          {postcards.map((card) => (
            <PostcardNode key={card.wish.id} card={card} now={now} highlighted={highlightWish === card.wish.id} onClick={onWishClick} />
          ))}
        </div>

        <div className="label-layer" id="labelLayer">
          {labels.map((label) => (
            <div
              key={label.cityKey}
              className={`tag${label.twoLine ? ' long' : ''}`}
              style={{ left: `${label.x}px`, top: `${label.y + label.h / 2}px`, width: `${label.w}px` }}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onLabelClick(label.cityKey);
              }}
            >
              <span className="city" title={label.name}>
                {label.name}
              </span>
              <span className="year">
                {label.year} · {label.count} 张
              </span>
            </div>
          ))}
          {destTags.map((tag) => (
            <button
              key={tag.destination.city}
              type="button"
              className="dest-tag"
              style={{ left: `${tag.x}px`, top: `${tag.y}px` }}
              onClick={(event) => {
                event.stopPropagation();
                onDestTag(tag.destination);
              }}
            >
              {tag.destination.name}
            </button>
          ))}
        </div>

        <div className="frog-layer" id="frogLayer">
          {frog ? <FrogNode x={frog.x} y={frog.y} mode={frog.mode} charmCount={frog.charmCount} onClick={onFrogClick} /> : null}
          {bubble ? <FrogBubble placement={bubble.placement} text={bubble.text} onDismiss={onBubbleDismiss} /> : null}
        </div>

        {frogActions ? <FrogActions x={frogActions.x} y={frogActions.y} below={frogActions.below} onAction={onFrogAction} /> : null}
        <RealPlaces camera={props.camera} metrics={props.metrics} mode={props.mode} project={project} />
        {props.mode !== 'world' ? <span className="schematic-credit">插画示意底图 · 非实测街道</span> : null}
        {destHint ? <div className="entrust-hint">选一个没去过的地方 · 青蛙下次路过时替你寄一张</div> : null}
      </div>
    </div>
  );
}

export type { Rect };
