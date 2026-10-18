'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, getSiteUrl } from '@/lib/supabase/config';
import { AccountsNotConfigured } from '@/components/auth/AccountsNotConfigured';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sparkles,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configured = isSupabaseConfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    return searchParams.get('error') === 'auth-callback-failed'
      ? 'This link has expired or was already used. If you already confirmed your email, just log in. Otherwise enter your email below to get a new link.'
      : null;
  });
  const [isUnconfirmed, setIsUnconfirmed] = useState(() => {
    return searchParams.get('error') === 'auth-callback-failed';
  });

  if (!configured) {
    return <AccountsNotConfigured />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsUnconfirmed(false);
    setResendSuccess(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const lowerMsg = (error.message || '').toLowerCase();

        // 1. Check if email is not confirmed
        if (
          lowerMsg.includes('email not confirmed') ||
          lowerMsg.includes('not confirmed') ||
          error.status === 400 && lowerMsg.includes('confirm')
        ) {
          setIsUnconfirmed(true);
          setErrorMessage('Your email address has not been confirmed yet.');
          setIsSubmitting(false);
          return;
        }

        // 2. Check if rate-limited
        if (
          lowerMsg.includes('too many') ||
          lowerMsg.includes('rate limit') ||
          error.status === 429
        ) {
          setErrorMessage('Too many login attempts. Please wait a few minutes before trying again.');
          setIsSubmitting(false);
          return;
        }

        // 3. Security requirement: No user enumeration!
        // Same message for wrong password and unknown email
        setErrorMessage('Invalid email or password.');
        setIsSubmitting(false);
        return;
      }

      toast.success('Logged in successfully!');

      // Safe redirect validation: only allow paths that start with single /
      const nextParam = searchParams.get('next');
      const safeNext =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? nextParam
          : '/generator';

      router.push(safeNext);
      router.refresh();
    } catch (err: unknown) {
      console.error('Login error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (isResending || !email.trim()) return;
    setIsResending(true);
    try {
      const supabase = createClient();
      const siteUrl = getSiteUrl();
      const emailRedirectTo = `${siteUrl}/auth/callback?next=/generator`;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        setResendSuccess(true);
        toast.success('Confirmation email resent!');
      }
    } catch {
      toast.error('Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 mb-1">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-poppins">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Log in to access OrbinexaCSV tools, Generator, and Analytics.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            {isUnconfirmed && (
              <div className="pt-2 border-t border-destructive/20">
                {resendSuccess ? (
                  <p className="text-emerald-500 font-medium">
                    &check; Confirmation email sent! Please check your inbox and spam folder.
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isResending}
                    onClick={handleResendConfirmation}
                    className="w-full text-xs h-8 gap-1.5 border-destructive/30 hover:bg-destructive/10"
                  >
                    <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
                    <span>Resend confirmation email</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email address</Label>
            <div className="relative">
              <Input
                id="login-email"
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

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary font-semibold hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="pl-9 pr-9"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full gap-2 font-semibold shadow-md shadow-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Log in</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-border/40 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
