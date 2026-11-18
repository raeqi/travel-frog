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
      <div className="app">
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <main className="main" id="main" tabIndex={-1}>
          <section className="screen is-active" data-screen="error">
            <div className="page screen-body">
              <div className="page-error" role="alert">
                <div className="error-icon" aria-hidden="true">
                  !
                </div>
                <h1>页面渲染失败</h1>
                <p>界面遇到未处理的错误。你的本地档案与照片原图没有受到影响，数据仍保存在 IndexedDB 中。</p>
                <div className="actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      this.reset();
                      window.location.hash = '/home';
                    }}
                  >
                    回到首页
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={this.reset}>
                    重试渲染
                  </button>
                </div>
                <div className="meta">{this.state.error.message}</div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }
}
