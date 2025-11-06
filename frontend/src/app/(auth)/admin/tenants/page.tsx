'use client';

import { TenantDataTable } from '@/components/admin/TenantDataTable';

export default function TenantsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
        <p className="text-gray-500">Manage all tenant organizations</p>
      </div>
      <TenantDataTable />
    </div>
  );
}
