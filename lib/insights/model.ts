import {isLocale, type Locale} from '../../i18n/public-routing';

// Search discovery is enabled separately from public navigation links.
export const INSIGHTS_DISCOVERABLE = true;
export const categories = ['real-estate', 'private-capital', 'consultancy'] as const;
export const formats = ['article', 'guide', 'case'] as const;
export type Insight = {
  id: string; article_id: string; locale: Locale; slug: string; title: string;
  summary: string; body: string; category: typeof categories[number];
  format: typeof formats[number]; region: string; author: string;
  sources: string[]; seo_title: string; seo_description: string;
  status: 'draft' | 'published' | 'archived'; publish_at: string | null;
  content_updated_on: string; updated_at: string; revision: number;
};
export const cardFields = 'id,article_id,locale,slug,title,summary,category,format,region,author,publish_at,content_updated_on';
export function insightPath(locale: string, slug?: string) {
  return `${locale === 'en' ? '' : '/' + locale}/insights${slug ? '/' + slug : ''}`;
}
export function validInsightSlug(value: string) {
  return value.length <= 120 && /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value);
}
export function safeSource(value: string) {
  try {const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash ? u.href : null;} catch {return null;}
}
export function publicationState(article: Pick<Insight, 'status' | 'publish_at'>, now = Date.now()) {
  if (article.status !== 'published') return article.status;
  return article.publish_at && Date.parse(article.publish_at) <= now ? 'published' : 'scheduled';
}
export function insightInput(form: FormData) {
  const text = (name: string, max: number, required = false) => {
    const value = String(form.get(name) ?? '').trim();
    if (value.length > max || (required && !value)) throw new Error(`Check ${name.replaceAll('_', ' ')}.`);
    return value;
  };
  const id = text('id', 36, true), article_id = text('article_id', 36, true);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id) || !uuid.test(article_id)) throw new Error('Invalid article reference.');
  const revision = Number(text('revision', 12, true));
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision.');
  const locale = text('locale', 10, true), slug = text('slug', 120, true);
  if (!isLocale(locale) || !validInsightSlug(slug)) throw new Error('Choose a language and a URL using letters, numbers and hyphens.');
  const category = text('category', 30), format = text('format', 20), status = text('status', 20);
  if (!(categories as readonly string[]).includes(category) || !(formats as readonly string[]).includes(format) || !['draft','published','archived'].includes(status)) throw new Error('Check category, format and publication status.');
  const title = text('title', 180, true), summary = text('summary', 500), body = text('body', 60000), author = text('author', 120);
  const date = text('publish_at', 40), content_updated_on = text('content_updated_on', 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(content_updated_on) || !Number.isFinite(Date.parse(content_updated_on)) || new Date(content_updated_on).toISOString().slice(0,10) !== content_updated_on) throw new Error('Choose a valid content review date.');
  // The editor sends an explicit UTC timestamp, never a server-local datetime.
  if (date && (!/Z$/.test(date) || !Number.isFinite(Date.parse(date)))) throw new Error('Choose a valid publication time.');
  if (status === 'published' && (!summary || !body || !author || !date)) throw new Error('Publishing requires a summary, article text, author and publication time.');
  const sources = text('sources', 6000).split('\n').map(s => s.trim()).filter(Boolean);
  if (sources.length > 10 || sources.some(s => s.length > 500 || !safeSource(s))) throw new Error('Use up to 10 public HTTPS source URLs, without query strings or fragments.');
  return {id, revision, data: {article_id, locale, slug, title, summary, body, category, format, status,
    region: text('region', 80), author, sources, seo_title: text('seo_title', 180), seo_description: text('seo_description', 320),
    publish_at: date ? new Date(date).toISOString() : null, content_updated_on}};
}

export type ContentBlock = {type: 'h2'|'h3'|'p'|'list'; text?: string; items?: string[]};
/** Deliberately limited Markdown: React escapes every string; no raw HTML. */
export function contentBlocks(body: string): ContentBlock[] {
  return body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(s=>s.trim()).flatMap<ContentBlock>(block => {
    const lines = block.trim().split('\n');
    if (lines.every(line => /^-\s/.test(line))) return [{type: 'list', items: lines.map(s=>s.replace(/^-\s+/,''))}];
    if (lines.length === 1 && /^###\s/.test(block)) return [{type:'h3', text:block.replace(/^###\s+/, '')}];
    if (lines.length === 1 && /^##\s/.test(block)) return [{type:'h2', text:block.replace(/^##\s+/, '')}];
    return [{type:'p', text:block.trim()}];
  });
}
