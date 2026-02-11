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
import { Loader2, Home, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  const [formData, setFormData] = useState({
    company_name: '',
    subdomain: '',
    admin_email: '',
    admin_password: '',
    admin_name: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await register(formData);
      router.push('/dashboard');
    } catch (error: unknown) {
      // Error handled by store, but log details for debugging
      const axiosError = error as { response?: { data?: unknown; status?: number } };
      console.error('Register error:', error);
      console.error('Response data:', axiosError.response?.data);
      console.error('Response status:', axiosError.response?.status);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Auto-format subdomain (lowercase, no spaces)
    if (e.target.name === 'subdomain') {
      value = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-5 w-5" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Create Account
          </CardTitle>
          <CardDescription className="text-center">
            Register your organization and admin account
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
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                name="company_name"
                type="text"
                placeholder="Acme Corporation"
                value={formData.company_name}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="subdomain"
                  name="subdomain"
                  type="text"
                  placeholder="acme"
                  value={formData.subdomain}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  pattern="[a-z0-9\-]+"
                  minLength={3}
                />
                <span className="text-sm text-muted-foreground">.yourdomain.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">Admin Account</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin_name">Full Name</Label>
                  <Input
                    id="admin_name"
                    name="admin_name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.admin_name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_email">Email</Label>
                  <Input
                    id="admin_email"
                    name="admin_email"
                    type="email"
                    placeholder="john@acme.com"
                    value={formData.admin_email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin_password"
                      name="admin_password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.admin_password}
                      onChange={handleChange}
                      required
                      minLength={8}
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
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters with uppercase, lowercase, and number
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <div className="text-sm text-center w-full text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Login here
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
