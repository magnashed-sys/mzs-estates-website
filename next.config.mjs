/** Basic headers compatible with existing images, galleries and external links. */
export default {
 async headers() {
  return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
   {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}
  ]}];
 }
};
