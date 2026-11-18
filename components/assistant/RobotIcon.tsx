import { useId } from 'react';

// Friendly light mint robot (original drawing, pure SVG, no image files).
// RobotIcon = head only (chat header and message avatars). RobotMascot = full robot for the launcher.

const MINT = { top: '#e6ffd9', mid: '#9ef0b8', low: '#4fd39a', deep: '#2fb487' };

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id + 'h'} x1="0.2" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor={MINT.top} />
        <stop offset="0.45" stopColor={MINT.mid} />
        <stop offset="1" stopColor={MINT.low} />
      </linearGradient>
      <linearGradient id={id + 'b'} x1="0.2" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={MINT.mid} />
        <stop offset="1" stopColor={MINT.deep} />
      </linearGradient>
      <linearGradient id={id + 'v'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#163a33" />
        <stop offset="1" stopColor="#0b1f1b" />
      </linearGradient>
    </defs>
  );
}

// Head drawn in a 100 x 80 box (antenna at the top)
function Head({ id }: { id: string }) {
  return (
    <>
      {/* antenna */}
      <line x1="50" y1="6" x2="50" y2="17" stroke={MINT.low} strokeWidth="3" strokeLinecap="round" />
      <circle className="rb-antenna" cx="50" cy="6" r="4.5" fill={MINT.mid} stroke={MINT.low} strokeWidth="1.5" />
      <rect x="40" y="15" width="20" height="7" rx="3" fill={MINT.low} />
      {/* head */}
      <rect x="10" y="20" width="80" height="58" rx="28" fill={`url(#${id}h)`} />
      {/* shine */}
      <ellipse cx="74" cy="30" rx="6" ry="3.5" fill="#fff" opacity="0.75" transform="rotate(25 74 30)" />
      <circle cx="82" cy="38" r="1.8" fill="#fff" opacity="0.6" />
      {/* visor */}
      <rect x="20" y="36" width="60" height="24" rx="12" fill={`url(#${id}v)`} />
      <path d="M66 39 q9 2 10 10" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <g className="rb-eyes">
        <circle cx="38" cy="48" r="7" fill="none" stroke="#e9fff1" strokeWidth="2" />
        <circle cx="38" cy="48" r="3.4" fill="#e9fff1" />
        <circle cx="36.2" cy="46.2" r="1.3" fill="#0b1f1b" />
        <circle cx="62" cy="48" r="7" fill="none" stroke="#e9fff1" strokeWidth="2" />
        <circle cx="62" cy="48" r="3.4" fill="#e9fff1" />
        <circle cx="60.2" cy="46.2" r="1.3" fill="#0b1f1b" />
      </g>
      {/* smile */}
      <path d="M43 66 q7 6 14 0 z" fill={MINT.deep} />
    </>
  );
}

export function RobotIcon({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const id = 'rbi' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 82" aria-hidden="true" className={animated ? 'robot-anim' : undefined}>
      <Defs id={id} />
      <Head id={id} />
    </svg>
  );
}

// Full robot: floats, tilts its head, blinks and waves (animations live in globals.css, off for reduced motion)
export function RobotMascot({ size = 72, animated = true }: { size?: number; animated?: boolean }) {
  const id = 'rbm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      width={size}
      height={Math.round(size * 1.3)}
      viewBox="0 0 100 130"
      aria-hidden="true"
      className={'robot-mascot' + (animated ? ' robot-anim' : '')}
      overflow="visible"
    >
      <Defs id={id} />
      {/* shadow on the floor (shrinks while the robot floats up) */}
      <ellipse className="rb-shadow" cx="50" cy="124" rx="22" ry="4" fill="#0b1f1b" opacity="0.18" />
      <g className="rb-float">
        {/* body */}
        <path d="M27 82 h46 a6 6 0 0 1 6 6 v6 a22 22 0 0 1 -22 22 h-14 a22 22 0 0 1 -22 -22 v-6 a6 6 0 0 1 6 -6 z" fill={`url(#${id}b)`} />
        <ellipse cx="66" cy="92" rx="3" ry="6" fill="#fff" opacity="0.35" />
        {/* right arm (still) */}
        <rect x="76" y="85" width="10" height="24" rx="5" fill={MINT.low} />
        <rect x="79" y="88" width="3" height="10" rx="1.5" fill="#fff" opacity="0.4" />
        {/* left arm (waves) */}
        <g className="rb-arm">
          <rect x="14" y="85" width="10" height="24" rx="5" fill={MINT.low} />
        </g>
        {/* head (tilts) */}
        <g className="rb-head">
          <Head id={id} />
        </g>
      </g>
    </svg>
  );
}
