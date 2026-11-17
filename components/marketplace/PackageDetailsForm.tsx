'use client';

// A guided form for vendors to describe a package, section by section.
// It is saved as simple formatted text (### headings and - lists) in the same "description"
// field as before, so the database, the contact-details check and the AI check stay the same.

import { RichDescription } from '@/components/marketplace/RichDescription';

type ListKey = 'get' | 'features' | 'delivery' | 'need' | 'notes';
export type PackageDetails = { summary: string; more: string } & Record<ListKey, string>;

const SECTIONS: { key: ListKey; heading: string; label: string; hint: string; placeholder: string; required?: boolean }[] = [
  {
    key: 'get',
    heading: 'What you get',
    label: 'What the buyer gets',
    hint: 'One item per line.',
    placeholder: 'Private account, only for you\nPro plan for the full duration\nWorks on 2 devices',
    required: true,
  },
  {
    key: 'features',
    heading: 'Features',
    label: 'Main features',
    hint: 'One feature per line.',
    placeholder: 'Unlimited messages\nImage generation\nFile uploads',
  },
  {
    key: 'delivery',
    heading: 'How you receive it',
    label: 'How the buyer receives it',
    hint: 'The steps after payment, one per line.',
    placeholder: 'We deliver the login details through OrbinexaCSV\nYou log in and change the password\nThe plan is active at once',
  },
  {
    key: 'need',
    heading: 'What we need from you',
    label: 'What you need from the buyer',
    hint: 'Leave empty if nothing is needed.',
    placeholder: 'Your Gmail address to activate the plan',
  },
  {
    key: 'notes',
    heading: 'Important notes',
    label: 'Important notes and rules',
    hint: 'Things the buyer must know before ordering.',
    placeholder: 'Do not change the account email\nWarranty does not cover sharing the account',
  },
];

const MORE_HEADING = 'More details';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();

export const EMPTY_DETAILS: PackageDetails = { summary: '', get: '', features: '', delivery: '', need: '', notes: '', more: '' };

// Saved text -> form fields. Anything we do not recognise (older free text) goes to "More details", so nothing is lost.
export function parseDetails(text: string | null | undefined): PackageDetails {
  const out: PackageDetails = { ...EMPTY_DETAILS };
  if (!text) return out;
  const known = new Map(SECTIONS.map((s) => [norm(s.heading), s.key]));
  const summary: string[] = [];
  const more: string[] = [];
  const lists: Record<ListKey, string[]> = { get: [], features: [], delivery: [], need: [], notes: [] };
  let current: ListKey | 'more' | 'summary' = 'summary';
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    // an old big title ("# Product name") at the top is kept, and the sentence after it still becomes the summary
    if (current === 'summary' && summary.length === 0 && /^#\s+/.test(line)) {
      more.push(line);
      continue;
    }
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      const k = known.get(norm(h[1]));
      if (k) current = k;
      else if (norm(h[1]) === norm(MORE_HEADING)) current = 'more';
      else {
        current = 'more';
        more.push(line);
      }
      continue;
    }
    if (current === 'summary') {
      if (line === '') continue;
      if (/^[-*•]\s+/.test(line)) {
        current = 'more';
        more.push(line);
      } else summary.push(line);
      continue;
    }
    if (current === 'more') {
      more.push(raw.trimEnd());
      continue;
    }
    if (line === '') continue;
    lists[current].push(line.replace(/^[-*•]\s+/, ''));
  }
  out.summary = summary.join(' ');
  (Object.keys(lists) as ListKey[]).forEach((k) => (out[k] = lists[k].join('\n')));
  out.more = more.join('\n').trim();
  return out;
}

const items = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean);

// Form fields -> saved text.
export function composeDetails(d: PackageDetails): string {
  const parts: string[] = [];
  if (d.summary.trim()) parts.push(d.summary.trim().replace(/\s*\n\s*/g, ' '));
  for (const s of SECTIONS) {
    const list = items(d[s.key]);
    if (list.length) parts.push(`### ${s.heading}\n${list.map((x) => `- ${x}`).join('\n')}`);
  }
  if (d.more.trim()) parts.push(`### ${MORE_HEADING}\n${d.more.trim()}`);
  return parts.join('\n\n');
}

// What must be filled before a package can be saved. Returns a message, or null when everything is fine.
export function checkDetails(d: PackageDetails): string | null {
  if (d.summary.trim().length < 15) return 'Please write a short summary of the package (at least 15 letters).';
  if (items(d.get).length === 0) return 'Please list at least one thing the buyer gets.';
  if (composeDetails(d).length > 3000) return 'The package details are too long (3000 letters at most).';
  return null;
}

type Props = { value: PackageDetails; onChange: (d: PackageDetails) => void };

export function PackageDetailsForm({ value, onChange }: Props) {
  const set = (k: keyof PackageDetails, v: string) => onChange({ ...value, [k]: v });
  const text = composeDetails(value);
  const box = 'w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed placeholder:italic placeholder:text-muted-foreground/45';

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-bold text-foreground">Package details</p>
        <p className="text-xs text-muted-foreground">
          Buyers read this before they order. Fill each part in simple words. Fields with <span className="text-primary">*</span> are required.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-foreground">
          Short summary <span className="text-primary">*</span>
        </label>
        <textarea
          value={value.summary}
          onChange={(e) => set('summary', e.target.value.slice(0, 220))}
          rows={2}
          className={box}
          placeholder="e.g. ChatGPT Plus private account for 1 month, ready to use within 1 hour."
        />
        <p className="text-xs text-muted-foreground">One or two sentences. Shown on the package card in the shop. {value.summary.length}/220</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.key} className="space-y-1">
            <label className="text-sm font-semibold text-foreground">
              {s.label} {s.required && <span className="text-primary">*</span>}
            </label>
            <textarea
              value={value[s.key]}
              onChange={(e) => set(s.key, e.target.value)}
              rows={4}
              className={box}
              placeholder={'e.g. ' + s.placeholder}
            />
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {value.more.trim().length > 0 && (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-foreground">More details (from your older text)</label>
          <textarea value={value.more} onChange={(e) => set('more', e.target.value)} rows={4} className={box} />
          <p className="text-xs text-muted-foreground">Move these lines into the boxes above if you like, or keep them here.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {text.length}/3000 letters. Do not write phone numbers, WhatsApp, links, real names or &quot;contact us&quot;. Buyers order only through
        OrbinexaCSV. Use **text** to make a word bold.
      </p>

      {text.trim().length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How buyers will see it</p>
          <RichDescription text={text} />
        </div>
      )}
    </div>
  );
}

// The summary line (first plain sentence) of saved details, for the shop card.
export function detailsSummary(text: string | null | undefined): string {
  return parseDetails(text).summary;
}
