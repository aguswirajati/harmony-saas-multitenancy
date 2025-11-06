'use client';

import { CreateTenantForm } from '@/components/admin/CreateTenantForm';
import { Card, CardContent } from '@/components/ui/card';

export default function NewTenantPage() {
  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Tenant</h1>
        <p className="text-gray-500">
          Add a new tenant organization with admin user
        </p>
      </div>
      <CreateTenantForm />
    </div>
  );
}
