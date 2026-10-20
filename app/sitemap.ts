import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
 if(process.env.VERCEL_ENV !== 'production') return [];
 return ['', '/real-estate', '/private-capital'].map(path=>({url:'https://www.mzsgroup.com'+path}));
}
