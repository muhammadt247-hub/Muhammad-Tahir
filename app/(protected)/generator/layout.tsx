import type { Metadata } from 'next';

// Browser tab title
export const metadata: Metadata = { title: 'CSV Generator' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
