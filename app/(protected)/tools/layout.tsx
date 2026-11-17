import type { Metadata } from 'next';

// Browser tab title
export const metadata: Metadata = { title: 'Tools' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
