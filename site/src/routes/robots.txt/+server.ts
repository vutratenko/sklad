import { siteUrl } from '../../../site.config.js';

export const prerender = true;
export function GET() {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl.href}sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
