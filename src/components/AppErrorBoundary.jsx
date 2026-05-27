import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-sm font-medium text-white/80">Something went wrong loading the app.</p>
        <p className="mt-3 max-w-md text-xs text-white/45">{error.message || String(error)}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 rounded-sm bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-80"
        >
          Reload page
        </button>
      </div>
    );
  }
}
