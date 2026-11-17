import type { Metadata } from 'next';

// Browser tab title
export const metadata: Metadata = { title: 'Adobe Stock Analytics' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
