import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site';

// Only real public pages (private and logged-in pages are never listed)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_CONFIG.SITE_URL.replace(/\/+$/, '');
  const pages: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/login', priority: 0.5, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/licenses', priority: 0.2, changeFrequency: 'yearly' },
  ];
  return pages.map((p) => ({
    url: base + (p.path === '/' ? '' : p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
