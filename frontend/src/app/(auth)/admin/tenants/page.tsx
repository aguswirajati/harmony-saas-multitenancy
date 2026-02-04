'use client';

import { TenantDataTable } from '@/components/admin/TenantDataTable';

export default function TenantsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tenants</h1>
        <p className="text-muted-foreground">Manage all tenant organizations</p>
      </div>
      <TenantDataTable />
    </div>
  );
}
