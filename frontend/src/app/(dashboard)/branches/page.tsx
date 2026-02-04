'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { branchAPI } from '@/lib/api/branches';
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
import { Plus, Search, Edit, Trash2, Building2, AlertTriangle, ArrowRight } from 'lucide-react';
import { BranchDialog } from '@/components/features/branches/BranchDialog';
import { DeleteBranchDialog } from '@/components/features/branches/DeleteBranchDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ current_count: number; limit: number } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await branchAPI.list({
        limit: 100,
        search: search || undefined
      });
      setBranches(response.branches);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [search]);

  const handleCreate = async () => {
    try {
      const result = await branchAPI.checkLimit();
      if (!result.can_add) {
        setLimitInfo({ current_count: result.current_count, limit: result.limit });
        setLimitDialogOpen(true);
        return;
      }
    } catch {
      // If limit check fails, allow creating (backend will still enforce)
    }
    setSelectedBranch(null);
    setDialogOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setDialogOpen(true);
  };

  const handleDelete = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (success?: boolean) => {
    setDialogOpen(false);
    setSelectedBranch(null);
    if (success) {
      loadBranches();
      queryClient.invalidateQueries({ queryKey: ['tenant-usage'] });
    }
  };

  const handleDeleteDialogClose = (success?: boolean) => {
    setDeleteDialogOpen(false);
    setSelectedBranch(null);
    if (success) {
      loadBranches();
      queryClient.invalidateQueries({ queryKey: ['tenant-usage'] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Branches</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's branch locations
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2" size={18} />
          Add Branch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Branches</p>
                <p className="text-2xl font-bold text-foreground mt-2">{total}</p>
              </div>
              <Building2 className="text-blue-600" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Branches</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {branches.filter(b => b.is_active).length}
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
                <p className="text-sm font-medium text-muted-foreground">Headquarters</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {branches.filter(b => b.is_hq).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 font-bold">HQ</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branch List</CardTitle>
              <CardDescription>All branch locations in your organization</CardDescription>
            </div>
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search branches..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-muted-foreground">Loading branches...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-muted-foreground mb-4">
                {search ? 'No branches found matching your search' : 'No branches yet'}
              </p>
              {!search && (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2" size={18} />
                  Add Your First Branch
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{branch.name}</span>
                          {branch.is_hq && (
                            <Badge variant="secondary">HQ</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {branch.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {branch.city && branch.province ? (
                            <>
                              {branch.city}, {branch.province}
                            </>
                          ) : branch.city || branch.province || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {branch.phone && (
                            <div className="text-muted-foreground">{branch.phone}</div>
                          )}
                          {branch.email && (
                            <div className="text-muted-foreground text-xs">{branch.email}</div>
                          )}
                          {!branch.phone && !branch.email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(branch)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(branch)}
                            disabled={branch.is_hq}
                          >
                            <Trash2 size={16} className={branch.is_hq ? 'text-gray-300' : 'text-red-600'} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <BranchDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        branch={selectedBranch}
      />

      <DeleteBranchDialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        branch={selectedBranch}
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
                <DialogTitle>Branch Limit Reached</DialogTitle>
                <DialogDescription className="mt-1">
                  You&apos;ve used {limitInfo?.current_count} of {limitInfo?.limit} branches allowed on your current plan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
            Upgrade your subscription to add more branches. Visit the Settings page to view available plans.
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
