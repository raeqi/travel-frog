import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a rendering failure must not leave a blank page, and must not
 * pretend the user's local archive was affected.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('travel-frog render failed', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="boot-screen" id="main" tabIndex={-1}>
        <div className="boot-card" role="alert">
          <div className="boot-mark" aria-hidden="true">
            !
          </div>
          <h1>页面渲染失败</h1>
          <p>界面遇到未处理的错误。你的本地档案与照片原图没有受到影响，数据仍保存在 IndexedDB 中。</p>
          <div className="boot-actions">
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                this.reset();
                window.location.reload();
              }}
            >
              重新加载
            </button>
            <button className="btn ghost" type="button" onClick={this.reset}>
              重试渲染
            </button>
          </div>
          <p className="boot-meta">{this.state.error.message}</p>
        </div>
      </main>
    );
  }
}
