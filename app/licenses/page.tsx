'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThirdPartyLicensesPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-poppins">
      <div className="flex items-center justify-between pb-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Third-Party Licences
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Open-source libraries and WASM binaries used in OrbinexaCSV.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href="/account">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Account
          </Link>
        </Button>
      </div>

      <div className="space-y-6 text-sm text-foreground/90">
        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-foreground">
              Ghostscript WASM (@jspawn/ghostscript-wasm)
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold">
              AGPL-3.0
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Ghostscript compiled to WebAssembly for client-side EPS and AI vector file conversion in the browser.
          </p>
          <div className="pt-2 flex items-center gap-4 text-xs font-medium">
            <span className="text-muted-foreground">Copyright © Artifex Software, Inc.</span>
            <a
              href="https://github.com/jsscheller/ghostscript-wasm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Source Repository <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-foreground">
              ImageTracer.js
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
              Unlicense (Public Domain)
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Raster image tracing library used by the Image to SVG Vectorizer. It runs in your browser.
          </p>
          <div className="pt-2 flex items-center gap-4 text-xs font-medium">
            <span className="text-muted-foreground">By András Jankovics</span>
            <a
              href="https://github.com/jankovicsandras/imagetracerjs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Source Repository <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-foreground">
              pdfjs-dist
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
              Apache-2.0
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            PDF rendering engine used for client-side extraction and preview generation of PDF-compatible Adobe Illustrator (.ai) files.
          </p>
          <div className="pt-2 flex items-center gap-4 text-xs font-medium">
            <span className="text-muted-foreground">Copyright © Mozilla Foundation</span>
            <a
              href="https://github.com/mozilla/pdf.js"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Source Repository <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-foreground">
              utif
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
              MIT
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Fast TIFF decoder library used for handling embedded raster previews.
          </p>
          <div className="pt-2 flex items-center gap-4 text-xs font-medium">
            <span className="text-muted-foreground">Copyright © Photopea / Ivan Kuckir</span>
            <a
              href="https://github.com/photopea/UTIF.js"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Source Repository <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
