import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label to identify which region failed (for logs). */
  region?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary. React render errors (thrown inside components, hooks,
 * canvas setup, wallet providers, etc.) are NOT caught by window.onerror, so
 * without this a single throw would unmount the whole tree and leave a blank
 * screen. This shows a branded recovery screen with a reload action instead.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for telemetry; keep the user-facing message generic.
    console.error(`[ErrorBoundary${this.props.region ? ':' + this.props.region : ''}]`, error, info?.componentStack);
  }

  handleReload = () => {
    // Full reload is the safest recovery for a game/WebGL/wallet crash.
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-center gap-4 p-6 text-center bg-slate-950 bg-[url('/bg-dark.webp')] bg-cover bg-center text-slate-100 font-sans"
      >
        <div className="absolute top-10 left-10 w-32 h-16 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-16 right-16 w-48 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="panel-clash relative z-10 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border-2 border-rose-500/50">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500/20 blur-3xl rounded-full pointer-events-none" />

          <div className="text-5xl mb-2" aria-hidden="true">🍕💥</div>
          <h1 className="text-2xl md:text-3xl font-pixel text-white text-stroke-title drop-shadow-xl uppercase">
            ¡Se quemó la pizza!
          </h1>
          <p className="font-vt text-lg text-blue-100 mt-3 leading-tight drop-shadow-sm">
            Algo se rompió en la cocina. Puedes reintentar o recargar el juego.
            Tu progreso guardado no se ha perdido.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button onClick={this.handleTryAgain} className="btn-clash-blue py-3 px-6 flex-1">
              Reintentar
            </button>
            <button onClick={this.handleReload} className="btn-clash-gold py-3 px-6 flex-1">
              Recargar Juego
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 max-h-[30vh] overflow-auto text-left text-[10px] text-rose-300 bg-slate-900/60 border border-rose-500/20 p-3 rounded-xl">
              {String(this.state.error?.stack || this.state.error?.message)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
