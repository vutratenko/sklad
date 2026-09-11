import { siteUrl } from '../../../site.config.js';

export const prerender = true;
export function GET() {
  const location = siteUrl.href.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${location}</loc></url></urlset>`,
    {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' }
    }
  );
}
