import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  withBackground?: boolean;
}

/**
 * OrbinexaCSV Official Brand Logo Icon
 * Circular slotted outer ring with dynamic navigation arrow & curved leaf cleft.
 * Based precisely on official brand icon asset.
 */
export function Logo({
  className,
  size = 28,
  withBackground = false,
  style,
  ...props
}: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      style={style}
      aria-label="OrbinexaCSV Logo"
      role="img"
      {...props}
    >
      {withBackground && (
        <circle cx="256" cy="256" r="256" fill="#000000" />
      )}

      {/* Outer Slotted Ring with rounded caps */}
      <path
        d="M 288 38 A 220 220 0 0 1 288 474"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M 224 474 A 220 220 0 0 1 224 38"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
      />

      {/* Inner White Disc with Negative-Space Arrow Cutout & Curved Stem */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="
          M 114 346
          A 168 168 0 1 1 230 422
          C 208 422 186 405 194 372
          C 202 340 224 312 246 288
          L 278 348
          L 326 168
          L 164 260
          L 222 268
          C 204 296 186 324 172 348
          C 158 368 136 360 114 346
          Z
        "
      />
    </svg>
  );
}

export function LogoMark(props: LogoProps) {
  return <Logo {...props} />;
}
