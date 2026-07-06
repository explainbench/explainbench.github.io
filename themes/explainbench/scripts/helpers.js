'use strict';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDescription(value, fallback = '') {
  const text = stripHtml(value || fallback);
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function siteBase() {
  return String(hexo.config.url || '').replace(/\/+$/, '');
}

function normalizePath(value) {
  const input = String(value || '/');
  if (/^https?:\/\//i.test(input)) return input;
  const path = input.startsWith('/') ? input : `/${input}`;
  return path.replace(/\/index\.html$/, '/').replace(/index\.html$/, '');
}

function absoluteUrl(value) {
  const input = normalizePath(value);
  if (/^https?:\/\//i.test(input)) return input;
  return `${siteBase()}${input}`;
}

function pagePath(page) {
  if (page?.canonical) return page.canonical;
  const rawPath = page?.path === 'index.html' ? '/' : `/${String(page?.path || '').replace(/index\.html$/, '')}`;
  return rawPath || '/';
}

function pageTitle(page = {}) {
  if (page.seoTitle) return page.seoTitle;
  if (page.title && page.title !== hexo.config.title) return `${page.title} | ${hexo.config.title}`;
  return hexo.config.subtitle ? `${hexo.config.title} | ${hexo.config.subtitle}` : hexo.config.title;
}

function pageDescription(page = {}) {
  return cleanDescription(page.description || page.subtitle || page.subheading || page.excerpt, hexo.config.description);
}

function pageKeywords(page = {}) {
  const values = page.keywords || hexo.config.keywords || [];
  return Array.isArray(values) ? values.filter(Boolean).join(', ') : String(values || '');
}

function pageImage(page = {}) {
  return absoluteUrl(page.image || hexo.config.social_image || '/assets/img/explainbench-hero.png');
}

function breadcrumbItems(page = {}) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: hexo.config.title,
      item: absoluteUrl('/')
    }
  ];
  if (pagePath(page) !== '/') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: page.label || page.title,
      item: absoluteUrl(pagePath(page))
    });
  }
  return items;
}

hexo.extend.helper.register('md_inline', function mdInline(value) {
  const rendered = hexo.render.renderSync({ text: String(value ?? ''), engine: 'markdown' }).trim();
  return rendered.replace(/^<p>/, '').replace(/<\/p>$/, '');
});

hexo.extend.helper.register('md_block', function mdBlock(value) {
  return hexo.render.renderSync({ text: String(value ?? ''), engine: 'markdown' }).trim();
});

hexo.extend.helper.register('icon', function icon(name) {
  return `<i data-lucide="${esc(name)}" aria-hidden="true"></i>`;
});

hexo.extend.helper.register('grid_class', function gridClass(columns) {
  return Number(columns) <= 2 ? 'two' : 'three';
});

hexo.extend.helper.register('content_card', function contentCard(content) {
  if (!String(content ?? '').trim()) return '';
  return `<article class="card content-card markdown-card prose">${content}</article>`;
});

hexo.extend.helper.register('content_section', function contentSection(content, options = {}) {
  if (!String(content ?? '').trim()) return '';
  const compact = options.compact ? 'compact-band' : '';
  return `
    <section class="band ${compact}">
      <div class="inner">
        <article class="card content-card markdown-card prose">${content}</article>
      </div>
    </section>
  `;
});

hexo.extend.helper.register('script_json', function scriptJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
});

hexo.extend.helper.register('absolute_url', absoluteUrl);

hexo.extend.helper.register('canonical_url', function canonicalUrl(page) {
  return absoluteUrl(pagePath(page));
});

hexo.extend.helper.register('page_meta_title', pageTitle);

hexo.extend.helper.register('page_meta_description', pageDescription);

hexo.extend.helper.register('page_meta_keywords', pageKeywords);

hexo.extend.helper.register('page_meta_image', pageImage);

hexo.extend.helper.register('seo_json_ld', function seoJsonLd(page = {}) {
  const base = absoluteUrl('/');
  const canonical = absoluteUrl(pagePath(page));
  const title = pageTitle(page);
  const description = pageDescription(page);
  const image = pageImage(page);
  const organizationId = `${base}#organization`;
  const websiteId = `${base}#website`;
  const webpageId = `${canonical}#webpage`;
  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: hexo.config.title,
      url: base,
      logo: absoluteUrl('/assets/img/favicon.svg')
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name: hexo.config.title,
      url: base,
      description: cleanDescription(hexo.config.description),
      publisher: { '@id': organizationId },
      inLanguage: hexo.config.language || 'en'
    },
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      publisher: { '@id': organizationId },
      primaryImageOfPage: image,
      inLanguage: hexo.config.language || 'en',
      dateModified: page.updated || page.date || page.lastmod
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems(page)
    }
  ];

  if (page.layout === 'paper') {
    graph.push({
      '@type': 'ScholarlyArticle',
      headline: page.paperTitle || page.title,
      name: page.paperTitle || page.title,
      description,
      url: canonical,
      image,
      author: (page.authors || []).map((name) => ({ '@type': 'Person', name })),
      citation: page.bibtex ? stripHtml(page.bibtex) : undefined,
      datePublished: page.datePublished || page.year,
      isPartOf: { '@id': webpageId }
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph.map((item) => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined && value !== '')))
  };
});
