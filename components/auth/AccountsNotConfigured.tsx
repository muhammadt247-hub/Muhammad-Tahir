'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Key, Shield, ExternalLink, ArrowLeft } from 'lucide-react';
import { LogoMark } from '@/components/Logo';

export function AccountsNotConfigured() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-md shadow-primary/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground font-poppins">
              Accounts are not configured
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Add the Supabase variables to your environment configuration to enable user accounts, sign up, and authentication.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            Required Environment Variables
          </span>
          <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground bg-background/80 p-3 rounded-lg border border-border/50">
            <div><span className="text-primary font-bold">NEXT_PUBLIC_SUPABASE_URL</span>=https://xyz.supabase.co</div>
            <div><span className="text-primary font-bold">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>=sb_publishable_...</div>
            <div><span className="text-primary font-bold">SUPABASE_SERVICE_ROLE_KEY</span>=sb_secret_...</div>
            <div><span className="text-primary font-bold">NEXT_PUBLIC_SITE_URL</span>=http://localhost:3000</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            Make sure Email Confirmation is turned ON in your Supabase project dashboard, and the redirect URL is set to <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">/auth/callback</code>.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md shadow-primary/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
