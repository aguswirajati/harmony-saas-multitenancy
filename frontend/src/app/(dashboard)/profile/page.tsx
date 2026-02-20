'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { userAPI } from '@/lib/api/users';
import { tenantsAPI } from '@/lib/api/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUpload } from '@/components/features/files/AvatarUpload';
import { Loader2, User, Mail, Phone, Building2, Shield, Calendar, Key, Trash2, AlertTriangle, Pencil, X, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { isTenantOwner } from '@/types/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, tenant, logout, refreshUser } = useAuthStore();

  // Edit profile states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });

  // Password states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Deletion states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [closurePhrase, setClosurePhrase] = useState('');
  const [closurePassword, setClosurePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    });
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm({
      ...profileForm,
      [e.target.name]: e.target.value,
    });
    setEditError(null);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    setEditError(null);

    try {
      await userAPI.update(user.id, {
        first_name: profileForm.first_name || null,
        last_name: profileForm.last_name || null,
        phone: profileForm.phone || null,
      });
      await refreshUser();
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setEditError(axiosError.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = user ? isTenantOwner(user) : false;

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      await userAPI.changePassword(user!.id, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordSuccess(true);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed successfully');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setPasswordError(axiosError.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await userAPI.deleteMyAccount(deletePassword);
      toast.success('Account deleted successfully');
      logout();
      router.push('/login');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setDeleteError(axiosError.response?.data?.detail || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseAccount = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await tenantsAPI.closeAccount({
        confirmation_phrase: closurePhrase,
        password: closurePassword,
      });
      toast.success('Account closed successfully');
      logout();
      router.push('/login');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setDeleteError(axiosError.response?.data?.detail || 'Failed to close account');
    } finally {
      setIsDeleting(false);
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your personal details and role</CardDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={user.avatar_url}
              userName={user.full_name || user.email}
              size="lg"
              onSuccess={() => toast.success('Avatar updated successfully')}
              onError={(err) => toast.error(err.message)}
            />
            <div>
              <h3 className="text-lg font-semibold">{user.full_name || 'No name set'}</h3>
              <p className="text-muted-foreground">{user.email}</p>
              <Badge className={`mt-2 ${getRoleBadgeColor(user.tenant_role)}`}>
                {user.tenant_role || 'member'}
              </Badge>
            </div>
          </div>

          <Separator />

          {isEditing ? (
            /* Edit Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={profileForm.first_name}
                  onChange={handleProfileChange}
                  placeholder="John"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={profileForm.last_name}
                  onChange={handleProfileChange}
                  placeholder="Doe"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={handleProfileChange}
                  placeholder="+62 812 3456 7890"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{tenant?.name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{user.tenant_role || 'member'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            {passwordSuccess && (
              <Alert className="border-green-500 text-green-700 dark:text-green-400">
                <AlertDescription>Password changed successfully!</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  name="current_password"
                  type={showPassword.current ? 'text' : 'password'}
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  required
                  disabled={isChangingPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  name="new_password"
                  type={showPassword.new ? 'text' : 'password'}
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  required
                  minLength={8}
                  disabled={isChangingPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  required
                  disabled={isChangingPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner ? (
            <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-900 rounded-lg">
              <div>
                <h3 className="font-semibold text-red-600 dark:text-red-400">Close Account</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your organization and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setClosureDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Close Account
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-900 rounded-lg">
              <div>
                <h3 className="font-semibold text-red-600 dark:text-red-400">Delete Account</h3>
                <p className="text-sm text-muted-foreground">
                  Remove your account from this organization. You will lose access to all data.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Account Dialog (for members) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete your account? This will remove your access to the organization.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-password">Enter your password to confirm</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder="Your password"
                />
              </div>
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletePassword('');
              setDeleteError(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!deletePassword || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Account Dialog (for owners) */}
      <AlertDialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Close Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="font-semibold text-red-600 dark:text-red-400">
                WARNING: This action is irreversible!
              </p>
              <p>
                Closing your account will permanently delete:
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>All users in your organization</li>
                <li>All branches and their data</li>
                <li>All files and documents</li>
                <li>Your subscription and billing history</li>
              </ul>
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="closure-phrase">
                    Type <span className="font-mono font-bold">DELETE MY ACCOUNT</span> to confirm
                  </Label>
                  <Input
                    id="closure-phrase"
                    value={closurePhrase}
                    onChange={(e) => {
                      setClosurePhrase(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder="DELETE MY ACCOUNT"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closure-password">Enter your password</Label>
                  <Input
                    id="closure-password"
                    type="password"
                    value={closurePassword}
                    onChange={(e) => {
                      setClosurePassword(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder="Your password"
                  />
                </div>
              </div>
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setClosurePhrase('');
              setClosurePassword('');
              setDeleteError(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={closurePhrase !== 'DELETE MY ACCOUNT' || !closurePassword || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                'Close Account'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
