'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // In production, you could send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
          <Card className="w-full max-w-2xl">
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 rounded-full p-3">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">
                Oops! Something went wrong
              </CardTitle>
              <CardDescription>
                We're sorry for the inconvenience. An unexpected error has occurred.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {isDevelopment && this.state.error && (
                <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    Error Details (Development Only):
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-red-600 break-all">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="text-xs text-gray-700">
                        <summary className="cursor-pointer font-semibold hover:text-gray-900">
                          Component Stack
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded border border-gray-200 overflow-auto max-h-40">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>What can you do?</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
                  <li>Try refreshing the page</li>
                  <li>Go back to the home page</li>
                  <li>If the problem persists, contact support</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple error fallback component
export function ErrorFallback({ error, resetError }: { error: Error; resetError?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="bg-red-100 rounded-full p-3 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-600 mb-4 max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>
      {resetError && (
        <Button onClick={resetError}>
          Try again
        </Button>
      )}
    </div>
  );
}
