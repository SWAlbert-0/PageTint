(function (root) {
  'use strict';
  const C = root.PageTint;
  const SKIP = 'script,style,noscript,nav,aside,footer,button,input,textarea,select,form,iframe,#pagetint-ui,[hidden],[role="navigation"],[role="banner"],.md-sidebar,.headerlink,.anchor-link,.toc,.table-of-contents,.copy-code-button';
  const BLOCK = /^(P|DIV|SECTION|ARTICLE|MAIN|HEADER|FIGURE|FIGCAPTION|ADDRESS|DETAILS|SUMMARY)$/;
  const escapeHTML = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escapeMD = value => escapeHTML(value).replace(/([\\`*_[\]{}|$=%%])/g, '\\$1').replace(/(^|\n)([ \t]*)([#>+-]|\d+[.)])(?=\s)/g, '$1$2\\$3');
  function safeURL(value, base) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href.replace(/[<>\r\n]/g, c => encodeURIComponent(c)) : null;
    } catch { return null; }
  }
  function filename(title) {
    let name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().replace(/[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '');
    if (!name) name = '网页正文';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name + '.md';
  }
  function articleRoot(doc) {
    const candidates = [...doc.querySelectorAll('article,main,[role="main"],.markdown-body,.md-content__inner,.theme-default-content,.vp-doc,.post-content,.entry-content')];
    const scored = candidates.filter(el => !el.closest('nav,aside,[hidden]')).map(el => {
      const copy = el.cloneNode(true); copy.querySelectorAll(SKIP).forEach(node => node.remove());
      const length = (copy.textContent || '').trim().length;
      const specific = el.matches('article,.markdown-body,.md-content__inner,.theme-default-content,.vp-doc,.post-content,.entry-content');
      return { el, score: length * (specific ? 1.25 : 1) };
    }).sort((a, b) => b.score - a.score);
    return scored.find(c => c.score > 0)?.el || doc.body;
  }
  function exportPage(doc, marks = [], options = {}) {
    const base = doc.location.href, selectedRoot = articleRoot(doc);
    const title = doc.title.trim() || selectedRoot.querySelector('h1')?.textContent.trim() || '网页正文';
    const warnings = new Set();
    const blocks = [];
    const protect = value => { const token = '\u0001BLOCK' + blocks.length + '\u0002'; blocks.push(value); return '\n\n' + token + '\n\n'; };
    if (selectedRoot === doc.body) warnings.add('未识别独立正文区域，已按页面主体导出，请检查正文范围');
    const byId = new Map(marks.map(mark => [mark.id, mark]));
    function skipped(node) {
      if (node.matches(SKIP) || node.matches('body > header')) return true;
      const style = doc.defaultView?.getComputedStyle(node);
      return style?.display === 'none' || style?.visibility === 'hidden';
    }
    function inherited(node, style) {
      const result = { ...style };
      if (node.matches('strong,b')) result.bold = true;
      if (node.matches('em,i')) result.italic = true;
      if (node.matches('u,ins')) result.underline = true;
      if (node.matches('s,del,strike')) result.strike = true;
      if (node.matches('mark')) result.background = '#ffdf6e99';
      const mark = byId.get(node.getAttribute('data-pagetint-id'));
      if (mark) {
        if (mark.color !== 'none') result.background = C.colorValue('highlight', mark.color);
        if (mark.fontColor) result.color = C.colorValue('text', mark.fontColor);
        if (mark.bold) result.bold = true;
        if (mark.underline) result.underline = true;
      }
      return result;
    }
    function formatted(value, style, html = false, preserve = false) {
      if (!value) return '';
      const useHTML = html || style.background || style.color || style.underline;
      const parts = preserve ? ['', '', value, ''] : value.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!parts[2]) return value.replace(/[\t\r\n ]+/g, ' ');
      let body = useHTML ? escapeHTML(parts[2]) : escapeMD(parts[2]);
      if (useHTML) {
        const css = [];
        if (style.background) css.push('background-color:' + style.background);
        if (style.color) css.push('color:' + style.color);
        if (style.bold) css.push('font-weight:700');
        if (style.italic) css.push('font-style:italic');
        if (style.underline || style.strike) css.push('text-decoration:' + [style.underline && 'underline', style.strike && 'line-through'].filter(Boolean).join(' '));
        if (css.length) body = `<span style="${css.join(';')}">${body}</span>`;
      } else {
        if (style.bold) body = '**' + body + '**';
        if (style.italic) body = '*' + body + '*';
        if (style.strike) body = '~~' + body + '~~';
      }
      return (parts[1] ? ' ' : '') + body + (parts[3] ? ' ' : '');
    }
    function math(node) {
      const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      if (!tex) return null;
      const block = node.matches('.katex-display') || node.getAttribute('display') === 'block';
      return block ? '\n\n$$\n' + tex.trim() + '\n$$\n\n' : '$' + tex.trim() + '$';
    }
    function children(node, style = {}, context = {}) {
      return [...node.childNodes].map(child => render(child, style, context)).join('');
    }
    function render(node, style = {}, context = {}) {
      if (node.nodeType === 3) {
        if (context.pre) return formatted(node.data, style, true, true);
        return formatted(node.data.replace(/[\t\r\n ]+/g, ' '), style);
      }
      if (node.nodeType !== 1 || skipped(node)) return '';
      const tag = node.tagName;
      if (node.matches('.katex-display,.katex,math')) { const tex = math(node); if (tex) return tex; }
      if (node.matches('svg,canvas,video,audio,mjx-container')) { warnings.add('部分图表、媒体或无法提取源码的公式未转换'); return ''; }
      const next = inherited(node, style);
      if (tag === 'BR') return context.cell ? '<br>' : '  \n';
      if (tag === 'HR') return '\n\n---\n\n';
      if (tag === 'IMG') {
        const src = safeURL(node.currentSrc || node.getAttribute('src'), base) || safeURL(node.getAttribute('data-src') || node.getAttribute('data-original'), base);
        if (!src) warnings.add('部分图片没有可用的在线地址，未写入文档');
        return src ? `![${escapeMD(node.getAttribute('alt') || '')}](<${src}>)` : '';
      }
      if (tag === 'PRE') {
        const code = node.querySelector('code') || node;
        const language = (code.className || '').match(/(?:language|lang)-([\w+-]+)/)?.[1] || '';
        if (node.querySelector('[data-pagetint-id],u,mark')) return protect('<pre><code>' + children(code, next, { pre: true }) + '</code></pre>');
        const value = code.textContent.replace(/\n$/, '');
        const runs = value.match(/`+/g) || [];
        const fence = '`'.repeat(Math.max(3, ...runs.map(s => s.length + 1)));
        return protect(fence + language + '\n' + value + '\n' + fence);
      }
      if (tag === 'CODE' && !context.pre) {
        if (next.background || next.color || next.underline || node.querySelector('[data-pagetint-id]')) {
          return '<code>' + children(node, next, { pre: true }) + '</code>';
        }
        const value = node.textContent;
        const fence = '`'.repeat(Math.max(1, ...(value.match(/`+/g) || []).map(s => s.length + 1)));
        const pad = value.includes('`') || /^ | $/.test(value) ? ' ' : '';
        const output = fence + pad + value + pad + fence;
        return next.bold ? '**' + output + '**' : output;
      }
      if (tag === 'A') {
        const value = children(node, next, context), href = safeURL(node.getAttribute('href'), base);
        return href && !context.pre ? `[${value}](<${href}>)` : value;
      }
      if (/^H[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + children(node, next).trim() + '\n\n';
      if (tag === 'BLOCKQUOTE') return '\n\n' + children(node, next).trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
      if (tag === 'UL' || tag === 'OL') {
        let number = Number(node.getAttribute('start')) || 1;
        const lines = [...node.children].filter(child => child.tagName === 'LI').map(li => {
          const marker = tag === 'OL' ? number++ + '. ' : '- ';
          const checkbox = li.querySelector(':scope > input[type="checkbox"]');
          const value = children(li, next, { list: true }).trim();
          const prefix = marker + (checkbox ? checkbox.checked ? '[x] ' : '[ ] ' : '');
          return prefix + value.split('\n').map((line, index) => index ? ' '.repeat(marker.length) + line : line).join('\n');
        });
        return '\n\n' + lines.join('\n') + '\n\n';
      }
      if (tag === 'TABLE') {
        const rows = [...node.querySelectorAll('tr')].filter(row => row.closest('table') === node).map(row =>
          [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(cell => children(cell, next, { cell: true }).trim().replace(/\n+/g, '<br>').replace(/\\\|/g, '&#124;').replace(/\|/g, '&#124;')));
        if (!rows.length) return '';
        const width = Math.max(...rows.map(row => row.length));
        const line = row => '| ' + Array.from({ length: width }, (_, i) => row[i] || '').join(' | ') + ' |';
        if (!node.querySelector('th')) rows.unshift(Array(width).fill(''));
        return '\n\n' + [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n') + '\n\n';
      }
      const value = children(node, next, context);
      if (BLOCK.test(tag)) return context.cell ? value + '<br>' : '\n\n' + value.trim() + '\n\n';
      return value;
    }
    let body = render(selectedRoot).trim();
    body = body.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').replace(/\u0001BLOCK(\d+)\u0002/g, (_, i) => blocks[Number(i)]);
    if (!body) throw new Error('未找到可导出的正文，请等待网页正文加载完成');
    if (!selectedRoot.querySelector('h1') && selectedRoot.tagName !== 'H1') body = '# ' + escapeMD(title) + '\n\n' + body;
    const source = C.pageKey(base), exportedAt = options.exportedAt || new Date().toISOString();
    const metadata = ['---', 'title: ' + JSON.stringify(title), 'source: ' + JSON.stringify(source), 'exported_at: ' + JSON.stringify(exportedAt), 'tags:', '  - 网页课程', '---', ''].join('\n');
    const missing = marks.filter(mark => ![...doc.querySelectorAll(`[data-pagetint-id="${mark.id}"]`)].some(node => selectedRoot.contains(node))).length;
    if (missing) warnings.add(`${missing} 条标记无法在当前正文定位，未写入相应样式`);
    return { markdown: metadata + '\n' + body + '\n', filename: filename(title), warnings: [...warnings] };
  }
  root.PageTintExport = { exportPage, filename, safeURL };
  if (typeof module !== 'undefined') module.exports = root.PageTintExport;
})(globalThis);
