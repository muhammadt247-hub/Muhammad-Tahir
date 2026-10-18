'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { AccountsNotConfigured } from '@/components/auth/AccountsNotConfigured';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  User,
  Mail,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const { user, profile, loading: authLoading, signOut, updateProfileName } = useAuth();

  const [displayName, setDisplayName] = useState(
    () => profile?.display_name || user?.email?.split('@')[0] || ''
  );
  const [isSavingName, setIsSavingName] = useState(false);

  // Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!configured) {
    return <AccountsNotConfigured />;
  }

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-muted' };
    if (pass.length < 8) return { score: 1, label: 'Too short (min 8 chars)', color: 'bg-red-500' };

    let score = 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 2, label: 'Weak', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Medium', color: 'bg-orange-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty.');
      return;
    }

    setIsSavingName(true);
    const res = await updateProfileName(displayName.trim());
    setIsSavingName(false);

    if (res.success) {
      toast.success('Display name updated in your account!');
    } else {
      toast.error(res.error || 'Failed to update display name.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
        setIsUpdatingPassword(false);
        return;
      }

      toast.success('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      console.error('Password change error:', err);
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const avatarLetter = (displayName.charAt(0) || user.email?.charAt(0) || 'C').toUpperCase();

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-8 font-poppins">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-600 to-orange-600 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-primary/25 border-2 border-primary/30 shrink-0">
            {avatarLetter}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Account Overview
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your OrbinexaCSV profile, credentials, and account settings.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={signOut}
          className="gap-2 text-xs font-semibold text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 shrink-0"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Account & Profile Details */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Profile Information</h2>
          </div>

          {/* Email with Verified Badge */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Registered Email</Label>
            <div className="p-3 rounded-xl bg-background/60 border border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-foreground truncate font-mono">
                  {user.email}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />
                Email verified
              </span>
            </div>
          </div>

          {/* Editable Display Name */}
          <form onSubmit={handleSaveDisplayName} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-display-name">Display Name (saved to profiles)</Label>
              <div className="relative">
                <Input
                  id="account-display-name"
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSavingName}
                  className="pl-9"
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                This name appears on your header avatar and workspace exports.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSavingName}
              className="w-full gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
            >
              {isSavingName ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Profile Name</span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Card 2: Security & Password Update */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Security &amp; Password</h2>
          </div>

          {passwordError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="account-new-password">New password</Label>
              <div className="relative">
                <Input
                  id="account-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                  className="pl-9 pr-9"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {newPassword.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="grid grid-cols-4 gap-1 h-1.5">
                    <div className={`rounded-full h-full transition-colors ${strength.score >= 1 ? strength.color : 'bg-muted'}`} />
                    <div className={`rounded-full h-full transition-colors ${strength.score >= 2 ? strength.color : 'bg-muted'}`} />
                    <div className={`rounded-full h-full transition-colors ${strength.score >= 3 ? strength.color : 'bg-muted'}`} />
                    <div className={`rounded-full h-full transition-colors ${strength.score >= 4 ? strength.color : 'bg-muted'}`} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Strength: {strength.label}</span>
                    <span>Min 8 characters</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="account-confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="account-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                  className="pl-9 pr-9"
                />
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isUpdatingPassword}
              variant="outline"
              className="w-full gap-2 text-xs font-semibold hover:bg-accent"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Change Password</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
