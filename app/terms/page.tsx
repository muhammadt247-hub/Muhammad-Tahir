'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12 font-poppins">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-md shadow-primary/20 mx-auto">
          <FileText className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Our full Terms of Service will be available soon. By using OrbinexaCSV during the preview period, you agree to comply with all applicable stock agency guidelines and fair use policies.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md shadow-primary/25"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Sign Up</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
