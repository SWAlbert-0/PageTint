(function (root) {
  'use strict';
  function escaped(source, index) {
    let slashes = 0;
    for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) slashes++;
    return slashes % 2 === 1;
  }
  function closing(source, start, delimiter, inline) {
    for (let i = start; i < source.length; i++) {
      if (inline && source[i] === '\n') return -1;
      if (source.startsWith(delimiter, i) && !escaped(source, i) && (!inline || (source[i - 1] && !/\s/.test(source[i - 1])))) return i;
    }
    return -1;
  }
  function parse(value) {
    const source = String(value || ''), tokens = [];
    let text = '';
    const flush = () => { if (text) tokens.push({ type: 'text', value: text }); text = ''; };
    for (let i = 0; i < source.length;) {
      if (source[i] === '\\' && source[i + 1] === '$') { text += '$'; i += 2; continue; }
      let delimiter = '', endDelimiter = '', display = false, inline = false;
      if (source.startsWith('$$', i)) { delimiter = endDelimiter = '$$'; display = true; }
      else if (source.startsWith('\\[', i) && !escaped(source, i)) { delimiter = '\\['; endDelimiter = '\\]'; display = true; }
      else if (source.startsWith('\\(', i) && !escaped(source, i)) { delimiter = '\\('; endDelimiter = '\\)'; inline = true; }
      else if (source[i] === '$' && source[i + 1] !== '$' && source[i + 1] && !/\s/.test(source[i + 1])) { delimiter = endDelimiter = '$'; inline = true; }
      if (!delimiter) { text += source[i++]; continue; }
      const start = i + delimiter.length;
      const end = closing(source, start, endDelimiter, inline);
      const tex = end < 0 ? '' : source.slice(start, end);
      if (end < 0 || !tex.trim()) { text += source[i++]; continue; }
      flush();
      tokens.push({ type: 'math', tex, display, raw: source.slice(i, end + endDelimiter.length) });
      i = end + endDelimiter.length;
    }
    flush();
    return tokens;
  }
  function render(container, value) {
    const doc = container.ownerDocument, errors = [];
    container.replaceChildren();
    for (const token of parse(value)) {
      if (token.type === 'text') {
        const span = doc.createElement('span'); span.className = 'comment-text'; span.textContent = token.value;
        container.append(span); continue;
      }
      const wrapper = doc.createElement(token.display ? 'div' : 'span');
      wrapper.className = token.display ? 'comment-math comment-math-display' : 'comment-math';
      wrapper.dataset.tex = token.tex;
      try {
        if (!root.katex) throw new Error('公式渲染器未加载');
        const html = root.katex.renderToString(token.tex, {
          displayMode: token.display, output: 'mathml', throwOnError: true,
          strict: 'warn', trust: false, maxExpand: 1000
        });
        const parsed = new doc.defaultView.DOMParser().parseFromString(html, 'text/html');
        const math = parsed.querySelector('math');
        if (!math) throw new Error('公式渲染失败');
        wrapper.append(doc.importNode(math, true));
      } catch (error) {
        wrapper.classList.add('comment-math-error'); wrapper.textContent = token.raw;
        wrapper.title = error.message; errors.push({ tex: token.tex, message: error.message });
      }
      container.append(wrapper);
    }
    return errors;
  }
  function toMarkdown(value, escapeText = text => text) {
    return parse(value).map(token => token.type === 'math' ? token.raw : escapeText(token.value)).join('').trim();
  }
  const api = { parse, render, toMarkdown };
  root.PageTintComments = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
