import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2, Users, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">SaaS Multi-Tenant</h1>
        <div className="space-x-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Multi-Tenant SaaS Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Complete solution for managing multiple branches, users, and business operations
            with role-based access control.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link href="/register">
              <Button size="lg" className="text-lg">
                Start Free Trial
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <Building2 className="text-blue-600 mb-4 mx-auto" size={48} />
              <h3 className="text-xl font-bold mb-2">Multi-Branch</h3>
              <p className="text-gray-600">
                Manage multiple locations with ease
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <Users className="text-green-600 mb-4 mx-auto" size={48} />
              <h3 className="text-xl font-bold mb-2">Team Management</h3>
              <p className="text-gray-600">
                Collaborate with your team members
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg">
              <Shield className="text-purple-600 mb-4 mx-auto" size={48} />
              <h3 className="text-xl font-bold mb-2">Role-Based Access</h3>
              <p className="text-gray-600">
                Secure permissions for every user
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
