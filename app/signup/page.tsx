'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  User,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const strength = getPasswordStrength(password);

  // Resend cooldown timer
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('You must agree to the Terms and Privacy Policy to proceed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const siteUrl = getSiteUrl();
      const emailRedirectTo = `${siteUrl}/auth/callback?next=/generator`;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            display_name: displayName.trim() || cleanEmail.split('@')[0],
          },
        },
      });

      if (error) {
        // Do not leak sensitive details; show clear message
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      setResendCooldown(60);
      toast.success('Account created! Please check your email.');
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      setErrorMessage('An unexpected error occurred during sign up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || isResending) return;
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
        toast.success('Confirmation email resent!');
        setResendCooldown(60);
      }
    } catch {
      toast.error('Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  // "Check your email" screen
  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20 mx-auto">
            <Mail className="h-7 w-7 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-poppins">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a verification link to:
            </p>
            <p className="font-semibold text-primary font-mono bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 inline-block text-sm">
              {email}
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Click the link inside to confirm your account and open DOCTORx.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 space-y-3">
            <Button
              type="button"
              variant="outline"
              disabled={resendCooldown > 0 || isResending}
              onClick={handleResendEmail}
              className="w-full gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {resendCooldown > 0
                ? `Resend email in ${resendCooldown}s`
                : 'Resend confirmation email'}
            </Button>

            <Link
              href="/login"
              className="inline-block text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline"
            >
              Already verified? Log in &rarr;
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
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-poppins">
            Create your account
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Join DOCTORx to generate stock metadata and inspect market trends.
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Email address</Label>
            <div className="relative">
              <Input
                id="signup-email"
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

          {/* Display Name (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-name" className="flex items-center justify-between">
              <span>Display name</span>
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Optional</span>
            </Label>
            <div className="relative">
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Elena Rostova"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
                className="pl-9"
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
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

            {/* Strength Hint Bar */}
            {password.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="grid grid-cols-4 gap-1 h-1.5">
                  <div
                    className={`rounded-full h-full transition-colors ${
                      strength.score >= 1 ? strength.color : 'bg-muted'
                    }`}
                  />
                  <div
                    className={`rounded-full h-full transition-colors ${
                      strength.score >= 2 ? strength.color : 'bg-muted'
                    }`}
                  />
                  <div
                    className={`rounded-full h-full transition-colors ${
                      strength.score >= 3 ? strength.color : 'bg-muted'
                    }`}
                  />
                  <div
                    className={`rounded-full h-full transition-colors ${
                      strength.score >= 4 ? strength.color : 'bg-muted'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                  <span>Strength: {strength.label}</span>
                  <span>Min 8 characters</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirm-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
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
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Terms and Privacy Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="agree-terms"
              type="checkbox"
              required
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <label htmlFor="agree-terms" className="text-xs text-muted-foreground leading-snug cursor-pointer select-none">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-primary font-semibold hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-primary font-semibold hover:underline">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isSubmitting || !agreeTerms}
            className="w-full gap-2 font-semibold shadow-md shadow-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-border/40 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
