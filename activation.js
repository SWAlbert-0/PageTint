(function (root) {
  'use strict';
  const ENABLED = 'pagetintEnabled', RULES = 'pagetintSiteRules';
  const MODES = ['auto', 'on', 'off'];
  const SELECTORS = 'article,[itemprop="articleBody"],main,[role="main"],.markdown-body,.theme-default-content,.vp-doc,.md-content__inner,.post-content,.entry-content,.article-content,.post-body';
  function hostname(url) {
    try { const parsed = new URL(url); return /^https?:$/.test(parsed.protocol) ? parsed.hostname : null; }
    catch { return null; }
  }
  function isLocalHost(host) {
    if (typeof host !== 'string') return false;
    const name = host.toLowerCase().replace(/\.$/, '');
    return name === 'localhost' || name.endsWith('.localhost') ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name) || name === '0.0.0.0' ||
      name === '[::1]' || name === '[::]' || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(name);
  }
  function modeFor(settings, host) {
    const rules = settings?.[RULES];
    const mode = rules && typeof rules === 'object' && Object.hasOwn(rules, host) ? rules[host] : 'auto';
    return MODES.includes(mode) ? mode : 'auto';
  }
  function articleType(document) {
    if ([...document.querySelectorAll('meta[property="og:type"]')].some(meta => /^(article|book)$/i.test(meta.content.trim()))) return true;
    if (document.querySelector('[itemtype*="schema.org/Article"],[itemtype*="schema.org/BlogPosting"],[itemtype*="schema.org/TechArticle"]')) return true;
    function hasType(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8) return false;
      const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      if (types.some(type => /^(Article|BlogPosting|TechArticle|NewsArticle|ScholarlyArticle)$/i.test(type || ''))) return true;
      return Object.values(value).some(child => child && typeof child === 'object' && hasType(child, depth + 1));
    }
    return [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 10).some(script => {
      if (script.textContent.length > 100000) return false;
      try { return hasType(JSON.parse(script.textContent)); } catch { return false; }
    });
  }
  function isArticle(document) {
    // Conversation turns often use <article> too; do not mistake chat apps for blog posts.
    if (document.querySelector('[data-message-author-role],[data-testid^="conversation-turn"],[role="log"]')) return false;
    const semantic = articleType(document);
    if (!semantic && document.querySelectorAll('article').length > 2) return false;
    const candidates = [...document.querySelectorAll(SELECTORS)].slice(0, 30);
    if (semantic && !candidates.length && document.body) candidates.push(document.body);
    return candidates.some(container => {
      if (container.closest('nav,aside,header,footer,[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),[role="application"]')) return false;
      // A feed made of article previews is not itself an article.
      if (container.querySelectorAll('article').length > 2) return false;
      const paragraphs = [...container.querySelectorAll('p')].filter(p => !p.closest('nav,aside,header,footer,form,[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"])'));
      const text = paragraphs.map(p => p.textContent.replace(/\s+/g, ' ').trim());
      const length = text.reduce((sum, p) => sum + p.length, 0);
      const long = text.filter(p => p.length >= 40).length;
      const linkLength = paragraphs.reduce((sum, p) => sum + [...p.querySelectorAll('a')].reduce((n, a) => n + a.textContent.trim().length, 0), 0);
      if (!length || linkLength / length > .45) return false;
      const heading = container.querySelector('h1,h2') || document.querySelector('h1');
      const editorial = semantic || container.matches('article,[itemprop="articleBody"],.post-content,.entry-content,.article-content,.post-body');
      if (!editorial && container.querySelector('input[type="password"],textarea,[role="textbox"],[contenteditable="true"]')) return false;
      if (editorial && length >= 160 && long >= 2) return true;
      return Boolean(heading && length >= 360 && long >= 3);
    });
  }
  function resolve(document, url, settings = {}) {
    const host = hostname(url), globalEnabled = settings[ENABLED] !== false, mode = host ? modeFor(settings, host) : 'auto';
    if (!host) return { enabled: false, globalEnabled, mode, hostname: null, reason: '此页面不支持网页编辑' };
    if (isLocalHost(host)) return { enabled: false, globalEnabled, mode, hostname: host, blocked: true, reason: '本地页面不启用 PageTint' };
    if (!globalEnabled) return { enabled: false, globalEnabled, mode, hostname: host, reason: '插件已暂停，已有数据仍保留' };
    if (mode === 'off') return { enabled: false, globalEnabled, mode, hostname: host, reason: '已在此网站停用' };
    if (mode === 'on') return { enabled: true, globalEnabled, mode, hostname: host, reason: '已在此网站手动启用' };
    const article = isArticle(document);
    return { enabled: article, globalEnabled, mode, hostname: host, reason: article ? '已识别为文章或文档页' : '未识别为文章页，当前不启用' };
  }
  const api = { ENABLED, RULES, hostname, isLocalHost, modeFor, isArticle, resolve };
  root.PageTintActivation = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
