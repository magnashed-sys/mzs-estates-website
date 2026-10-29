import createNextIntlPlugin from 'next-intl/plugin';
/** Basic headers compatible with existing images, galleries and external links. */
export default createNextIntlPlugin()({
 serverExternalPackages: ['pdfjs-dist'],
 outputFileTracingIncludes: {'/admin/workspaces/accountancy/purchases/upload': ['./scripts/extract-purchase-pdf.mjs','./node_modules/pdfjs-dist/package.json','./node_modules/pdfjs-dist/legacy/build/**','./node_modules/@napi-rs/canvas/**','./node_modules/@napi-rs/canvas-linux-x64-gnu/**'],'/admin/group/estates/contracts': ['./lib/estates/fonts/DejaVuSans.ttf']},
 async headers() {
  return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
   {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}
  ]}, ...['/images/home-hero-960.webp', '/images/home-hero-1536.webp', '/images/social/group.jpg', '/images/social/about.jpg', '/images/social/consultancy.jpg', '/images/social/capital.jpg', '/images/mzs-group-mark.svg'].map(source => ({source, headers: [{key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate'}]}))];
 }
});
