'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or error reporting service
    console.error('Application error:', error);

    // In production, send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error);
  }, [error]);

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
            We encountered an unexpected error while processing your request.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isDevelopment && (
            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Error Details (Development Only):
              </p>
              <div className="space-y-2">
                <p className="text-xs font-mono text-red-600 break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-gray-600">
                    Error ID: <span className="font-mono">{error.digest}</span>
                  </p>
                )}
                {error.stack && (
                  <details className="text-xs text-gray-700">
                    <summary className="cursor-pointer font-semibold hover:text-gray-900">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 p-2 bg-white rounded border border-gray-200 overflow-auto max-h-60 text-xs">
                      {error.stack}
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
              <li>Try again by clicking the button below</li>
              <li>Refresh the page to start fresh</li>
              <li>Go back to the home page</li>
              <li>If the problem continues, please contact support</li>
            </ul>
          </div>

          {!isDevelopment && error.digest && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600">
                Error reference: <span className="font-mono font-semibold">{error.digest}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Include this reference when contacting support
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={reset}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Page
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
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
