'use client';

// Public home page for OrbinexaCSV, in the "Ember" theme:
// deep red atmosphere, serif headings, scroll reveals, floating parallax cards and a dot grid.
// All shapes are drawn with CSS (no third-party images). Text describes only real features.

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Eraser,
  FileSpreadsheet,
  ImageIcon,
  PenTool,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  Wand2,
} from 'lucide-react';

const FEATURES = [
  { icon: Wand2, title: 'Metadata Generator', text: 'Titles, descriptions and keywords written for each image, in the format each stock site expects.' },
  { icon: ShieldCheck, title: 'Compliance Guard', text: 'Flags brand names, famous people, AI labels and other risky words before you upload.' },
  { icon: FileSpreadsheet, title: 'Ready CSV export', text: 'One click for an upload-ready CSV, or write the metadata straight into your JPG and PNG files.' },
  { icon: Eraser, title: 'Background Remover', text: 'Clean cut-outs for photos, icons and logos, with a refine brush and shop-ready sizes.' },
  { icon: PenTool, title: 'Image to SVG', text: 'Turn flat images into smooth vector SVG files right in your browser.' },
  { icon: ImageIcon, title: 'Image Converter', text: 'Convert, resize and compress images in batches without uploading them anywhere.' },
];

const STEPS = [
  { n: '01', icon: Upload, title: 'Upload', text: 'Drop in your photos, vectors or videos and choose your stock site.' },
  { n: '02', icon: Sparkles, title: 'Generate', text: 'AI studies every image and writes careful, search-friendly metadata.' },
  { n: '03', icon: FileSpreadsheet, title: 'Export', text: 'Review, edit if you like, then download your CSV and upload.' },
];

const PLATFORMS = ['Adobe Stock', 'Shutterstock', 'Freepik', 'General CSV'];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1) reveal on scroll
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // 2) gentle parallax (skipped when the visitor prefers less motion)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const onScroll = () => {
      if (reduce) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (heroRef.current && y < 1000) {
          heroRef.current.style.transform = `translateY(${y * 0.3}px)`;
          heroRef.current.style.opacity = String(Math.max(0, 1 - y / 650));
        }
        if (upRef.current) upRef.current.style.transform = `translateY(${y * -0.05}px)`;
        if (downRef.current) downRef.current.style.transform = `translateY(${y * 0.05}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative text-foreground">
      {/* ---------- HERO ---------- */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-6 py-24">
        {/* glowing ember shapes (CSS only) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_78%)] dark:opacity-100 dark:[mask-image:none]">
          <div className="ember-float-a absolute -left-[12%] -top-[18%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_40%_40%,hsl(8_95%_48%/.65),hsl(0_85%_30%/.25)_45%,transparent_70%)] blur-2xl" />
          <div className="ember-float-b absolute -bottom-[22%] -right-[10%] h-[65vmin] w-[65vmin] rounded-full bg-[radial-gradient(circle_at_60%_60%,hsl(20_100%_50%/.55),hsl(4_85%_32%/.25)_45%,transparent_70%)] blur-2xl" />
          <div className="absolute left-1/2 top-1/2 h-[40vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(10_80%_35%/.18)] blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div ref={heroRef} className="relative z-10 mx-auto max-w-4xl text-center will-change-transform">
          <div className="reveal">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.25em] text-foreground/70 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI toolkit for stock contributors
            </p>
          </div>
          <div className="reveal" style={{ transitionDelay: '120ms' }}>
            <h1 className="text-glow text-5xl font-medium leading-[1.05] tracking-tight text-foreground dark:text-[#ffe6dc] sm:text-6xl md:text-7xl">
              OrbinexaCSV.
              <br />
              <span className="font-normal italic">Your stock studio.</span>
            </h1>
          </div>
          <div className="reveal" style={{ transitionDelay: '240ms' }}>
            <p className="mx-auto mt-6 max-w-xl text-base font-light leading-relaxed text-foreground/75 dark:text-[#ffe6dc]/85 md:text-lg">
              Titles, keywords and clean cut-outs for Adobe Stock, Shutterstock and Freepik. Made for contributors who would
              rather create than type.
            </p>
          </div>
          <div className="reveal mt-12 flex flex-col items-center gap-5" style={{ transitionDelay: '360ms' }}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_hsl(18_92%_50%/.35)] transition hover:shadow-[0_14px_50px_hsl(18_92%_50%/.5)]"
              >
                Start free
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:rotate-45" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-full border border-foreground/20 bg-foreground/5 px-7 py-3 text-sm font-medium uppercase tracking-widest text-foreground/85 backdrop-blur-sm transition hover:bg-foreground/10"
              >
                Log in
              </Link>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/65">
              Free credits on sign up <span className="mx-2 text-foreground/30">|</span> No card needed
            </p>
          </div>
        </div>
      </section>

      {/* ---------- STATEMENT ---------- */}
      <section className="relative px-6 py-28 md:py-36">
        <div className="reveal mx-auto max-w-4xl text-center">
          <h2 className="text-3xl leading-tight text-foreground/90 md:text-5xl lg:text-6xl">
            We write the metadata. <span className="italic text-primary">You keep creating.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
            Every image is studied carefully: subject, style, mood and what buyers really search for. It takes a few seconds
            more, so your files get better titles and fewer rejections.
          </p>
        </div>
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 items-center justify-items-center gap-6 md:grid-cols-4">
          {PLATFORMS.map((p, i) => (
            <div
              key={p}
              className="reveal text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60 transition-colors hover:text-foreground/85"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {p}
            </div>
          ))}
        </div>
        <p className="reveal mt-4 text-center text-xs uppercase tracking-[0.2em] text-foreground/50">Export formats supported</p>
      </section>

      {/* ---------- FLOATING CARDS ---------- */}
      <section className="relative overflow-hidden px-6 py-28 md:py-40">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #6b4a40 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="reveal mb-20 text-center md:mb-28">
            <h2 className="text-5xl md:text-7xl">
              One studio,
              <br />
              <span className="italic">two ways to grow</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div ref={downRef} className="will-change-transform">
              <Link
                href="/signup"
                className="reveal group flex aspect-[4/5] flex-col justify-between rounded-3xl bg-primary p-8 shadow-2xl transition-shadow duration-500 hover:shadow-[0_20px_60px_hsl(18_92%_50%/.35)] md:p-12"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/10 transition-transform duration-500 group-hover:rotate-45">
                    <Sparkles className="h-6 w-6 text-black" />
                  </div>
                  <span className="rounded-full border border-black/20 px-3 py-1 text-sm font-medium text-black">01</span>
                </div>
                <div>
                  <h3 className="mb-4 font-serif text-4xl leading-none tracking-tight text-black md:text-5xl">
                    For
                    <br />
                    contributors
                  </h3>
                  <p className="text-lg leading-snug text-black/75">
                    Upload a batch, get careful titles and keywords, check them for risky words, and export a CSV ready for your
                    stock site.
                  </p>
                </div>
                <div className="mt-8 h-px w-full bg-black/15" />
              </Link>
            </div>
            <div ref={upRef} className="will-change-transform md:mt-24">
              <Link
                href="/marketplace"
                className="reveal group flex aspect-[4/5] flex-col justify-between rounded-3xl border border-foreground/10 bg-card p-8 shadow-2xl transition-colors duration-500 hover:border-primary/50 md:p-12"
                style={{ transitionDelay: '150ms' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 transition-transform duration-500 group-hover:scale-110">
                    <Store className="h-6 w-6 text-foreground" />
                  </div>
                  <span className="rounded-full border border-foreground/10 px-3 py-1 text-sm font-medium text-foreground/50">02</span>
                </div>
                <div>
                  <h3 className="mb-4 font-serif text-4xl leading-none tracking-tight text-foreground md:text-5xl">
                    The
                    <br />
                    marketplace
                  </h3>
                  <p className="text-lg leading-snug text-muted-foreground">
                    Buy AI tools and digital subscriptions from checked vendors. You pay only through OrbinexaCSV, and we check
                    every delivery before it reaches you.
                  </p>
                </div>
                <div className="mt-8 h-px w-full bg-foreground/10" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="reveal mb-14 max-w-2xl">
            <h2 className="text-4xl md:text-5xl">
              Everything a contributor <span className="italic text-primary">needs</span>
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="reveal group rounded-3xl border border-foreground/8 bg-card/70 p-7 backdrop-blur-sm transition-colors duration-500 hover:border-primary/40"
                style={{ transitionDelay: `${(i % 3) * 100}ms` }}
              >
                <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform duration-500 group-hover:scale-110">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-serif text-2xl text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- STEPS ---------- */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="reveal mb-14 text-center">
            <h2 className="text-4xl md:text-5xl">
              Three steps. <span className="italic">Minutes, not hours.</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="reveal relative rounded-3xl border border-foreground/8 bg-card/60 p-7" style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="font-mono text-xs tracking-[0.25em] text-primary">{s.n}</span>
                <s.icon className="mt-5 h-6 w-6 text-foreground/80" />
                <h3 className="mt-4 font-serif text-2xl text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative overflow-hidden px-6 py-28 md:py-36">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[50vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(12_90%_40%/.25)] blur-3xl opacity-50 dark:opacity-100" />
        <div className="reveal relative mx-auto max-w-3xl text-center">
          <h2 className="text-glow text-4xl text-foreground dark:text-[#ffe6dc] md:text-6xl">
            Ready when <span className="italic">you are.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-muted-foreground">
            Create a free account, drop in your first images and see the difference in a few minutes.
          </p>
          <Link
            href="/signup"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition hover:scale-105"
          >
            Create free account
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:rotate-45" />
          </Link>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="relative overflow-hidden border-t border-foreground/5 px-6 py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <p aria-hidden className="select-none font-serif text-[13vw] font-bold leading-[0.8] tracking-tighter text-foreground/[0.06] md:text-[9vw]">
            OrbinexaCSV.
          </p>
          <div className="flex flex-col gap-6 md:text-right">
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground md:justify-end">
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/licenses" className="transition-colors hover:text-foreground">Licenses</Link>
              <Link href="/login" className="transition-colors hover:text-foreground">Log in</Link>
            </nav>
            <p className="text-sm text-foreground/55">© {new Date().getFullYear()} OrbinexaCSV. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
