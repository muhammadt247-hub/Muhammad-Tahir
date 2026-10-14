import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  withBackground?: boolean;
}

/**
 * DOCTORx Geometric "X" Brand Logo
 * Matches the official bold geometric X insignia on brand dark orange.
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
      aria-label="DOCTORx Logo"
      role="img"
      {...props}
    >
      {withBackground && (
        <rect width="512" height="512" rx="112" fill="#D9560B" />
      )}
      <path
        fill={withBackground ? '#ffffff' : 'currentColor'}
        d="M 75 107.5 L 202 107.5 L 256 175.75 L 310 107.5 L 437 107.5 L 319.5 256 L 437 404.5 L 310 404.5 L 256 336.25 L 202 404.5 L 75 404.5 L 192.5 256 Z"
      />
    </svg>
  );
}

export function LogoMark(props: LogoProps) {
  return <Logo {...props} />;
}
