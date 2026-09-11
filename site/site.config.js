// Set SITE_URL for a custom domain. CI derives the default from the repository.
const repository = process.env.GITHUB_REPOSITORY || 'vutratenko/sklad';
const [owner, name] = repository.split('/');
const defaultPath = name === `${owner}.github.io` ? '' : `/${name}`;
export const siteUrl = new URL(process.env.SITE_URL || `https://${owner}.github.io${defaultPath}/`);
siteUrl.pathname = `${siteUrl.pathname.replace(/\/+$/, '')}/`;
export const base = siteUrl.pathname.replace(/\/$/, '');
