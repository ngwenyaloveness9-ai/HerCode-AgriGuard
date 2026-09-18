import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/common/DataState';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/** Global boundary so a render failure degrades one region, not the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AgriGuard render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="p-6">
            <ErrorState
              title="This screen stopped responding"
              description={this.state.error.message}
              onRetry={() => this.setState({ error: null })}
            />
          </div>
        )
      );
    }
    return this.props.children;
  }
}
