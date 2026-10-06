import type { MetadataRoute } from 'next';

// The admin is private: nothing here should ever be indexed (also sent as X-Robots-Tag and <meta robots>).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
