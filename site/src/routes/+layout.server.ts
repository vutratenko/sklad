import { siteUrl } from '../../site.config.js';

export function load() {
  return { siteUrl: siteUrl.href, year: new Date().getUTCFullYear() };
}
