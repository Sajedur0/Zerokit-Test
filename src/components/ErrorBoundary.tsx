/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="border border-rose-500/30 bg-rose-500/5 rounded-2xl p-8 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 text-2xl font-black">
          !
        </div>
        <div>
          <h3 className="text-sm font-mono font-extrabold uppercase tracking-wider text-rose-500">
            This tool hit an unexpected error
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] mt-2 max-w-md mx-auto break-words">
            {this.state.message}
          </p>
          <p className="text-[10px] text-[var(--theme-text-muted)]/70 mt-1">
            The rest of ZeroKit keeps working — try again or switch to another tool.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95"
        >
          Retry Tool
        </button>
      </div>
    );
  }
}
