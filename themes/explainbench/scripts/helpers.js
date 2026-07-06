'use strict';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
