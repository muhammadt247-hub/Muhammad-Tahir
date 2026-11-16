// Ember block loader: four glowing blocks join, burst apart and turn (styles in app/globals.css).
import { cn } from '@/lib/utils';

type Props = {
  label?: string; // small text under the blocks; pass "" to hide it
  size?: number; // size of one block in px (default 22)
  className?: string;
};

export function EmberLoader({ label = 'Loading', size = 22, className }: Props) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-6', className)}>
      <div className="relative" style={{ ['--s' as string]: `${size}px` }}>
        <div className="ember-loader-glow" aria-hidden />
        <div className="ember-loader" style={{ ['--s' as string]: `${size}px` }} aria-hidden>
          <span className="ember-block b1" />
          <span className="ember-block b2" />
          <span className="ember-block b3" />
          <span className="ember-block b4" />
        </div>
      </div>
      {label ? (
        <span className="font-serif text-sm italic tracking-[0.3em] text-foreground/70">{label}…</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
