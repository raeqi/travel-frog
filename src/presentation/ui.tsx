import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../domain/photo/photo';
import { useService } from './context';
import { placeholderFor } from './format';
import { Icon } from './icons';

/* ---------- toast ---------- */

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  push(input: { tone?: ToastTone; title: string; detail?: string }): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICON: Record<ToastTone, string> = {
  success: 'check',
  info: 'info',
  warning: 'alert',
  error: 'alert',
};

let toastSequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((input: { tone?: ToastTone; title: string; detail?: string }) => {
    toastSequence += 1;
    const item: ToastItem = {
      id: toastSequence,
      tone: input.tone ?? 'info',
      title: input.title,
      ...(input.detail ? { detail: input.detail } : {}),
    };
    setItems((current) => [...current, item]);
    window.setTimeout(() => {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    }, 4400);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`} role="status">
            <Icon name={TONE_ICON[item.tone]} />
            <div className="toast-text">
              <b>{item.title}</b>
              {item.detail ? <span>{item.detail}</span> : null}
            </div>
            <button
              className="toast-close"
              type="button"
              aria-label="关闭提示"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            >
              <Icon name="close" className="icon icon-sm" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('ToastProvider is missing');
  return api;
}

export function useAction(): {
  busy: boolean;
  run: (work: () => Promise<void>, options?: { success?: string; error?: string }) => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = useCallback(
    async (work: () => Promise<void>, options?: { success?: string; error?: string }) => {
      setBusy(true);
      try {
        await work();
        if (options?.success) toast.push({ tone: 'success', title: options.success });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '操作失败';
        toast.push({ tone: 'error', title: options?.error ?? '操作失败', detail: message });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

/* ---------- modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  sub,
  icon,
  tone = 'info',
  wide = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  icon?: string;
  tone?: 'info' | 'danger' | 'pending';
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'Tab' && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>('input, textarea, button');
      target?.focus();
    }, 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={panel}
      >
        <div className="modal-head">
          {icon ? (
            <span className={`modal-icon${tone === 'info' ? ' is-info' : tone === 'pending' ? ' is-pending' : ''}`}>
              <Icon name={icon} />
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="modal-title">{title}</h2>
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
          <button className="icon-btn icon-btn-sm" type="button" aria-label="关闭" onClick={onClose}>
            <Icon name="close" className="icon icon-sm" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="screen is-active" data-screen={name}>
      <div className="page screen-body">{children}</div>
    </section>
  );
}

export function PageHead({
  crumb,
  eyebrow,
  title,
  lede,
  actions,
}: {
  crumb?: ReactNode;
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="head-main">
        {crumb ? <div className="crumb">{crumb}</div> : null}
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}

/* ---------- states ---------- */

export function EmptyState({
  icon,
  title,
  body,
  actions,
  meta,
  tone,
}: {
  icon: string;
  title: string;
  body: string;
  actions?: ReactNode;
  meta?: string;
  tone?: 'pending' | 'danger';
}) {
  return (
    <div className="state-page">
      <div className={`big-icon${tone ? ` is-${tone}` : ''}`}>
        <Icon name={icon} />
      </div>
      <h1>{title}</h1>
      <p>{body}</p>
      {actions ? <div className="actions">{actions}</div> : null}
      {meta ? <div className="meta">{meta}</div> : null}
    </div>
  );
}

export function ErrorState({
  icon = 'alert',
  title,
  body,
  actions,
  meta,
}: {
  icon?: string;
  title: string;
  body: string;
  actions?: ReactNode;
  meta?: string;
}) {
  return (
    <div className="page-error">
      <div className="error-icon">
        <Icon name={icon} className="icon icon-lg" />
      </div>
      <h1>{title}</h1>
      <p>{body}</p>
      {actions ? <div className="actions">{actions}</div> : null}
      {meta ? <div className="meta">{meta}</div> : null}
    </div>
  );
}

export function LoadingState({ note }: { note: string }) {
  return (
    <div>
      <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
      <div className="sk-grid" style={{ marginTop: 16 }}>
        <div className="skeleton sk-tile" />
        <div className="skeleton sk-tile" />
        <div className="skeleton sk-tile" />
      </div>
      <div className="loading-note" role="status" aria-live="polite">
        <span className="spinner" />
        {note}
      </div>
    </div>
  );
}

/* ---------- photo ---------- */

export function PhotoThumb({
  photo,
  className = '',
  label,
  alt,
}: {
  photo: Photo;
  className?: string;
  label?: string;
  alt?: string;
}) {
  const service = useService();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!photo.thumbRef) {
      setUrl(null);
      return;
    }
    void service
      .thumbnail(photo.id)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.thumbRef, service]);

  return (
    <div className={`ph ${placeholderFor(photo.id)} ${className}`.trim()} role="img" aria-label={alt ?? photo.fileName}>
      {url ? <img src={url} alt="" className="ph-img" /> : <span className="ph-art" />}
      {label ? <span className="ph-label">{label}</span> : null}
    </div>
  );
}

/* ---------- small bits ---------- */

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'confirmed' | 'pending' | 'info' | 'danger';
  dot?: boolean;
  icon?: string;
}) {
  return (
    <span className={`badge badge-${tone}${dot ? ' badge-dot' : ''}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}
