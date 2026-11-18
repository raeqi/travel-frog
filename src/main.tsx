import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import './styles/home.css';
import './styles/room-motion.css';
import { TravelFrogService } from './application/travel-frog-service';
import { openDatabase } from './infrastructure/persistence/idb/database';
import { IdbUnitOfWork } from './infrastructure/persistence/idb/unit-of-work';
import { BrowserExifReader } from './infrastructure/exif/exif-reader.browser';
import { GazetteerCityResolver } from './infrastructure/geo/city-resolver';
import { RingBufferLogger } from './infrastructure/logging/ring-buffer-logger';
import { BrowserFingerprintReader } from './infrastructure/media/fingerprint.browser';
import { CanvasThumbnailGenerator } from './infrastructure/media/thumbnail-generator.browser';
import { CryptoIdGenerator } from './infrastructure/crypto-id-generator';
import { SystemClock } from './infrastructure/system-clock';
import { App } from './presentation/App';

const container = document.getElementById('root');
if (!container) throw new Error('Root container is missing');
const root = createRoot(container);

function renderFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : '未知错误';
  root.render(
    <main className="boot-screen" id="main" tabIndex={-1}>
      <div className="boot-card" role="alert">
        <div className="boot-mark" aria-hidden="true">
          !
        </div>
        <h1>无法打开本地档案</h1>
        <p>浏览器拒绝了 IndexedDB 访问，可能是隐私模式、存储被清理，或数据库被其他标签页占用。</p>
        <p>你的照片原图从未被复制进浏览器，已有数据没有被删除。关闭其他标签页或恢复存储后刷新页面即可重试。</p>
        <button className="btn primary" type="button" onClick={() => window.location.reload()}>
          刷新重试
        </button>
        <p className="boot-meta">{message}</p>
      </div>
    </main>,
  );
}

async function start(): Promise<void> {
  const clock = new SystemClock();
  const logger = new RingBufferLogger();
  const db = await openDatabase(window.indexedDB, clock.now());
  const service = new TravelFrogService({
    gateway: new IdbUnitOfWork(db),
    clock,
    ids: new CryptoIdGenerator(),
    exif: new BrowserExifReader(),
    thumbnails: new CanvasThumbnailGenerator(),
    fingerprints: new BrowserFingerprintReader(),
    cityResolver: new GazetteerCityResolver(),
    logger,
  });
  root.render(
    <StrictMode>
      <App service={service} />
    </StrictMode>,
  );
  await service.load();
}

void start().catch((error: unknown) => {
  console.error('travel-frog bootstrap failed', error);
  renderFatal(error);
});
