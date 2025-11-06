'use client';

import { useState, useEffect } from 'react';
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
import { Plus, Search, Edit, Trash2, Building2 } from 'lucide-react';
import { BranchDialog } from '@/components/features/branches/BranchDialog';
import { DeleteBranchDialog } from '@/components/features/branches/DeleteBranchDialog';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  const handleCreate = () => {
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
    }
  };

  const handleDeleteDialogClose = (success?: boolean) => {
    setDeleteDialogOpen(false);
    setSelectedBranch(null);
    if (success) {
      loadBranches();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-500 mt-1">
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
                <p className="text-sm font-medium text-gray-600">Total Branches</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{total}</p>
              </div>
              <Building2 className="text-blue-600" size={32} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Branches</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
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
                <p className="text-sm font-medium text-gray-600">Headquarters</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
              <p className="mt-2 text-gray-600">Loading branches...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-4">
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
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
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
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {branch.phone && (
                            <div className="text-gray-600">{branch.phone}</div>
                          )}
                          {branch.email && (
                            <div className="text-gray-500 text-xs">{branch.email}</div>
                          )}
                          {!branch.phone && !branch.email && (
                            <span className="text-gray-400">-</span>
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
    </div>
  );
}
