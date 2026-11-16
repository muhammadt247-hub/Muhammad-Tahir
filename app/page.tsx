import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';

// Public home page. Logged-in users are sent to /generator by the middleware before this renders.
export const metadata: Metadata = {
  title: 'OrbinexaCSV | AI metadata, CSV export and image tools for stock contributors',
  description:
    'Titles, keywords and upload-ready CSV files for Adobe Stock, Shutterstock and Freepik, plus a background remover, SVG vectorizer and more.',
};

export default function HomePage() {
  return <Landing />;
}
