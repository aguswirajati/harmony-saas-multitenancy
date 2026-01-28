'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mail, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/authStore';

export function EmailVerificationBanner() {
  const { user } = useAuthStore();
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show banner if user is verified or banner is dismissed
  if (!user || user.is_verified || dismissed) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    setError(null);

    try {
      await apiClient.post('/auth/resend-verification', null, {
        params: { email: user.email }
      });
      setResent(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setResent(false);
      }, 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in sessionStorage (reappears on page refresh)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('email_banner_dismissed', 'true');
    }
  };

  if (resent) {
    return (
      <Alert className="bg-green-50 border-green-200 mb-4">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900 ml-2">
          <div className="flex items-center justify-between">
            <span>
              <strong>Email sent!</strong> Check your inbox for the verification link.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200 mb-4">
      <Mail className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-900 ml-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <strong>Please verify your email address.</strong>{' '}
            We sent a verification link to <strong>{user.email}</strong>.
            {error && (
              <span className="text-red-600 block mt-1 text-sm">{error}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendEmail}
              disabled={isResending}
              className="bg-white"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-1 h-3 w-3" />
                  Resend Email
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
