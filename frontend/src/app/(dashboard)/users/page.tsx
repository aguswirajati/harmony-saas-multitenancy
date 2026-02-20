'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { userAPI } from '@/lib/api/users';
import { branchAPI } from '@/lib/api/branches';
import { UserWithBranch } from '@/types/user';
import { Branch } from '@/types/branch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Users as UsersIcon, Shield, AlertTriangle, ArrowRight, User } from 'lucide-react';
import { UserDialog } from '@/components/features/users/UserDialog';
import { DeleteUserDialog } from '@/components/features/users/DeleteUserDialog';
import { useAuthStore } from '@/lib/store/authStore';
import { useTenantPermission } from '@/hooks/use-permission';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserWithBranch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);

  // Permission checks
  const canCreateUser = useTenantPermission('tenant.users.create');
  const canUpdateUser = useTenantPermission('tenant.users.update');
  const canDeleteUser = useTenantPermission('tenant.users.delete');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ current_count: number; limit: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithBranch | null>(null);

  const loadBranches = async () => {
    try {
      const response = await branchAPI.list({ limit: 100 });
      setBranches(response.branches);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.list({
        limit: 100,
        search: search || undefined,
        tenant_role: roleFilter !== 'all' ? roleFilter : undefined,
        branch_id: branchFilter !== 'all' ? branchFilter : undefined,
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, branchFilter]);

  const handleCreate = async () => {
    try {
      const result = await userAPI.checkLimit();
      if (!result.can_add) {
        setLimitInfo({ current_count: result.current_count, limit: result.limit });
        setLimitDialogOpen(true);
        return;
      }
    } catch {
      // If limit check fails, allow creating (backend will still enforce)
    }
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: UserWithBranch) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDelete = (user: UserWithBranch) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (success?: boolean) => {
    setDialogOpen(false);
    setSelectedUser(null);
    if (success) {
      loadUsers();
      queryClient.invalidateQueries({ queryKey: ['tenant-usage'] });
    }
  };

  const handleDeleteDialogClose = (success?: boolean) => {
    setDeleteDialogOpen(false);
    setSelectedUser(null);
    if (success) {
      loadUsers();
      queryClient.invalidateQueries({ queryKey: ['tenant-usage'] });
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900';
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900';
      case 'member':
      default:
        return 'bg-muted text-foreground hover:bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage team members and their access
          </p>
        </div>
        {canCreateUser && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2" size={18} />
            Add User
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-foreground mt-2">{total}</p>
              </div>
              <UsersIcon className="text-blue-600" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {users.filter(u => u.is_active).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {users.filter(u => ['admin', 'owner'].includes(u.tenant_role || '')).length}
                </p>
              </div>
              <Shield className="text-purple-600" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Members</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {users.filter(u => u.tenant_role === 'member').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <UsersIcon className="text-muted-foreground" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <CardTitle>User List</CardTitle>
              <CardDescription>All team members in your organization</CardDescription>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="w-full md:w-48">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-muted-foreground mb-4">
                {search || roleFilter !== 'all' || branchFilter !== 'all'
                  ? 'No users found matching your filters'
                  : 'No users yet'}
              </p>
              {!search && roleFilter === 'all' && branchFilter === 'all' && canCreateUser && (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2" size={18} />
                  Add Your First User
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isCurrentUser = user.id === currentUser?.id;
                    return (
                      <TableRow key={user.id} className={isCurrentUser ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-300 font-semibold">
                                {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {user.full_name || user.email.split('@')[0]}
                                {isCurrentUser && (
                                  <Badge variant="outline" className="text-xs py-0 px-1.5">
                                    You
                                  </Badge>
                                )}
                              </div>
                              {user.phone && (
                                <div className="text-xs text-muted-foreground">{user.phone}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.tenant_role)}>
                            {user.tenant_role || 'member'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.branch_name ? (
                            <div className="text-sm">
                              <div>{user.branch_name}</div>
                              <div className="text-xs text-muted-foreground">{user.branch_code}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isCurrentUser ? (
                              <Link href="/profile">
                                <Button variant="ghost" size="sm" title="Go to your profile">
                                  <User size={16} />
                                </Button>
                              </Link>
                            ) : (
                              <>
                                {canUpdateUser && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(user)}
                                    title="Edit user"
                                  >
                                    <Edit size={16} />
                                  </Button>
                                )}
                                {canDeleteUser && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(user)}
                                    title="Delete user"
                                  >
                                    <Trash2 size={16} className="text-red-600" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        user={selectedUser}
        branches={branches}
      />

      <DeleteUserDialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        user={selectedUser}
      />

      {/* Limit Reached Dialog */}
      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <DialogTitle>User Limit Reached</DialogTitle>
                <DialogDescription className="mt-1">
                  You&apos;ve used {limitInfo?.current_count} of {limitInfo?.limit} users allowed on your current plan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
            Upgrade your subscription to add more users. Visit the Settings page to view available plans.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>
              Close
            </Button>
            <Link href="/settings?tab=subscription">
              <Button>
                View Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
