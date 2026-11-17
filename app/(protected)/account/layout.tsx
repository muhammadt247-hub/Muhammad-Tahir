import type { Metadata } from 'next';

// Browser tab title
export const metadata: Metadata = { title: 'Account' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
