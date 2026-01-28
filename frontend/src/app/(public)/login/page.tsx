'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated, user, checkAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenant_subdomain: ''
  });

  // Check auth on mount and redirect if already authenticated
  useEffect(() => {
    checkAuth();
    const { isAuthenticated: authed, user: u } = useAuthStore.getState();
    if (authed && u) {
      const redirectPath = u.role === 'super_admin' ? '/admin' : '/dashboard';
      router.replace(redirectPath);
    } else {
      setReady(true);
    }
  }, [checkAuth, router]);

  // Also redirect if auth state changes (e.g. after login)
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = user.role === 'super_admin' ? '/admin' : '/dashboard';
      router.push(redirectPath);
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login({
        email: formData.email,
        password: formData.password,
        tenant_subdomain: formData.tenant_subdomain || undefined
      });

      // Role-based redirect: super_admin → /admin, others → /dashboard
      const user = useAuthStore.getState().user;
      const redirectPath = user?.role === 'super_admin' ? '/admin' : '/dashboard';
      router.push(redirectPath);
    } catch (error) {
      // Error handled by store
      console.error('Login error:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!ready) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center">
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
                placeholder="admin@demo.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant_subdomain">
                Tenant Subdomain <span className="text-gray-400">(Optional)</span>
              </Label>
              <Input
                id="tenant_subdomain"
                name="tenant_subdomain"
                type="text"
                placeholder="demo"
                value={formData.tenant_subdomain}
                onChange={handleChange}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Leave empty if you only have one account
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Register here
            </Link>
          </div>

          <div className="text-xs text-center text-gray-500">
            Demo account: admin@demo.com / admin123
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
