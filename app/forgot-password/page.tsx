'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, getSiteUrl } from '@/lib/supabase/config';
import { AccountsNotConfigured } from '@/components/auth/AccountsNotConfigured';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  KeyRound,
  Mail,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!configured) {
    return <AccountsNotConfigured />;
  }

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const siteUrl = getSiteUrl();
      const redirectTo = `${siteUrl}/auth/callback?next=/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        // Prevent user enumeration in security context, but notify if rate-limited
        if (error.status === 429) {
          setErrorMessage('Too many requests. Please wait a few minutes before trying again.');
        } else {
          setErrorMessage(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      setIsSent(true);
      setResendCooldown(60);
      toast.success('Reset link sent! Please check your email.');
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      setErrorMessage('Failed to send reset link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20 mx-auto">
            <Mail className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-poppins">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for <span className="font-semibold text-primary font-mono">{email}</span>, we have sent a secure password reset link.
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Click the link inside to set a new password. The link will expire in 1 hour.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 space-y-3">
            <Button
              type="button"
              variant="outline"
              disabled={resendCooldown > 0 || isSubmitting}
              onClick={handleSendReset}
              className="w-full gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
              {resendCooldown > 0
                ? `Resend link in ${resendCooldown}s`
                : 'Resend reset link'}
            </Button>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to log in</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 mb-1">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-poppins">
            Reset password
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Enter your email and we will send you a link to reset your account password.
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSendReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Account Email</Label>
            <div className="relative">
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="pl-9"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full gap-2 font-semibold shadow-md shadow-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending link...</span>
              </>
            ) : (
              <>
                <span>Send reset link</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-border/40 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to log in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
