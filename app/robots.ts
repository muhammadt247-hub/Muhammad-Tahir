import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site';

// Search engines may read the public pages only. Account, tools, generator, marketplace and API stay private.
export default function robots(): MetadataRoute.Robots {
  const base = SITE_CONFIG.SITE_URL.replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/generator',
          '/account',
          '/tools',
          '/adobe-analytics',
          '/marketplace',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
