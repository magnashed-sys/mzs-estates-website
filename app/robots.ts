import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
 if(process.env.VERCEL_ENV !== 'production') return {rules:{userAgent:'*',disallow:'/'}};
 return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/private/','/private$','/api/','/auth/','/reset-password','/accept-invitation']},sitemap:'https://www.mzsgroup.com/sitemap.xml'};
}
