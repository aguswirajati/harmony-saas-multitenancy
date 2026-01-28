'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '32rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            padding: '2rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                marginBottom: '1rem'
              }}>
                <svg
                  style={{ width: '2rem', height: '2rem', color: '#dc2626' }}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Application Error
              </h1>

              <p style={{
                color: '#6b7280',
                marginBottom: '1.5rem'
              }}>
                A critical error occurred. Please try refreshing the page.
              </p>

              {error.digest && (
                <p style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  marginBottom: '1.5rem',
                  fontFamily: 'monospace'
                }}>
                  Error ID: {error.digest}
                </p>
              )}

              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexDirection: 'column'
              }}>
                <button
                  onClick={reset}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Try Again
                </button>

                <button
                  onClick={() => window.location.href = '/'}
                  style={{
                    backgroundColor: 'white',
                    color: '#374151',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
