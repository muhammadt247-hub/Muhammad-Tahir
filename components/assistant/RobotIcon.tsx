// Friendly futuristic robot head in the Ember colours (pure SVG, no image files)
export function RobotIcon({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={animated ? 'robot-anim' : undefined}>
      <defs>
        <linearGradient id="rb-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd2b8" />
          <stop offset="1" stopColor="#f3a27a" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a0d07" />
          <stop offset="1" stopColor="#120806" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <line x1="32" y1="6" x2="32" y2="14" stroke="#ffd2b8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="4" fill="#ff7a2f" className="robot-antenna" />
      {/* ears */}
      <rect x="4" y="27" width="7" height="14" rx="3" fill="#f3a27a" />
      <rect x="53" y="27" width="7" height="14" rx="3" fill="#f3a27a" />
      {/* head */}
      <rect x="9" y="14" width="46" height="40" rx="14" fill="url(#rb-head)" />
      {/* visor */}
      <rect x="15" y="22" width="34" height="20" rx="9" fill="url(#rb-visor)" />
      {/* eyes */}
      <g className="robot-eyes">
        <rect x="21" y="28" width="7" height="8" rx="3.5" fill="#ff8a3d" />
        <rect x="36" y="28" width="7" height="8" rx="3.5" fill="#ff8a3d" />
      </g>
      {/* mouth */}
      <rect x="26" y="46" width="12" height="3" rx="1.5" fill="#c2572a" opacity="0.8" />
    </svg>
  );
}
