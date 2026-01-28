'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

function EmailVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError('Invalid or missing verification token');
        setIsVerifying(false);
        return;
      }

      try {
        await apiClient.post('/auth/verify-email', { token });
        setSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (err: any) {
        setError(
          err.response?.data?.detail ||
          'Failed to verify email. The link may have expired.'
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Verifying Your Email
            </CardTitle>
            <CardDescription>
              Please wait while we verify your email address...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Email Verified Successfully!
            </CardTitle>
            <CardDescription>
              Your email has been verified. You can now access all features of your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-900">
                Redirecting to login page in 3 seconds...
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="w-full">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Verification Failed
          </CardTitle>
          <CardDescription>
            {error || 'We couldn\'t verify your email address.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              The verification link may have expired or been used already.
              You can request a new verification email from your account settings.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <Link href="/login" className="w-full">
            <Button className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Go to Login
            </Button>
          </Link>
          <p className="text-xs text-center text-gray-500">
            You can resend the verification email after logging in
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <EmailVerificationContent />
    </Suspense>
  );
}
