'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Home } from 'lucide-react';

// For hydration-safe mounting
const emptySubscribe = () => () => {};

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated, user, checkAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenant_subdomain: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Hydration-safe mounting check
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Check auth and determine ready state
  const performAuthCheck = useCallback(() => {
    checkAuth();
    const { isAuthenticated: authed, user: u } = useAuthStore.getState();
    if (authed && u) {
      const redirectPath = u.role === 'super_admin' ? '/admin' : '/dashboard';
      router.replace(redirectPath);
      return false; // Not ready to show login
    }
    return true; // Ready to show login
  }, [checkAuth, router]);

  useEffect(() => {
    if (!mounted) return;
    const isReady = performAuthCheck();
    if (isReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for hydration-safe auth check
      setReady(true);
    }
  }, [mounted, performAuthCheck]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData);
      // Get fresh state directly from store after login completes
      const { user: loggedInUser } = useAuthStore.getState();
      if (loggedInUser) {
        const redirectPath = loggedInUser.role === 'super_admin' ? '/admin' : '/dashboard';
        router.replace(redirectPath);
      }
    } catch {
      // Error is handled by the store
    }
  };

  // Don't render until ready
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <Link href="/">
              <Button variant="ghost" size="icon" title="Go to home">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant_subdomain">
                Organization Subdomain{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="tenant_subdomain"
                name="tenant_subdomain"
                type="text"
                placeholder="your-company"
                value={formData.tenant_subdomain}
                onChange={handleChange}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if you are a super admin
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Register here
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
