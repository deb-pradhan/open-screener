import { Component, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Section error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-signal-error/20 bg-signal-error/5">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-signal-error mx-auto mb-2" />
            <p className="text-ink-secondary text-sm mb-1">
              Failed to load this section
            </p>
            <p className="text-ink-tertiary text-xs mb-3">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
