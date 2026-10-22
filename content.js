(() => {
  'use strict';
  const C = globalThis.PageTint;
  const A = globalThis.PageTintActivation;
  // Local development pages never get a toolbar, observers or keyboard handlers.
  if (A.isLocalHost(A.hostname(location.href))) return;
  const host = document.createElement('div');
  host.id = 'pagetint-ui';
  host.style.cssText = 'all:initial!important;display:none!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    :host{font:14px/1.6 "Microsoft YaHei",sans-serif;color:#203346}
    *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;border:1px solid #c8d7df;border-radius:7px;background:white;color:#203346;padding:6px 10px}button:hover{background:#e8f3f5}button:disabled{cursor:default;opacity:.5}button:focus-visible,input:focus-visible{outline:2px solid #087e8b;outline-offset:2px}
    [hidden]{display:none!important}.toolbar,.toast{pointer-events:auto;background:#fff;box-shadow:0 6px 28px #20334626;border:1px solid #c8d7df}
    .toolbar{position:fixed;display:flex;gap:5px;padding:7px;border-radius:9px;width:310px;max-width:calc(100vw - 16px);flex-wrap:wrap;align-items:center}.palette{display:flex;gap:5px;flex-wrap:wrap;width:100%;border-top:1px solid #dce6eb;padding-top:6px}.palette-label{width:100%;font-size:12px;color:#59717d}.swatch{width:29px;height:27px;padding:0}.swatch[aria-pressed="true"]{outline:2px solid #087e8b;outline-offset:1px}
    .toast{position:fixed;left:50%;bottom:25px;transform:translateX(-50%);padding:10px 18px;border-radius:8px;max-width:90vw}
    .toolbar{max-height:calc(100vh - 16px);overflow:auto}.swatch{position:relative}.swatch[aria-pressed="true"]::after{content:'✓';position:absolute;right:-3px;top:-6px;border-radius:50%;background:white;color:#203346;font-size:11px;line-height:14px;width:14px;text-align:center}.more,.more:hover{background:conic-gradient(#ff9292,#ffdf79,#9bdfad,#8bcfff,#c9a2ed,#ff9292);color:#203346;font-size:20px;font-weight:700;text-shadow:0 1px 2px white}.expanded{width:100%;border-top:1px solid #dce6eb;padding-top:8px}.expanded-title{font-size:12px;color:#59717d;margin-bottom:7px}.color-grid{display:grid;grid-template-columns:repeat(8,29px);gap:7px;margin:7px 0 10px}.recent{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 12px}.custom{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.custom label{font-size:12px}.custom input[type=color]{width:30px;height:29px;border:1px solid #c8d7df;background:white;border-radius:5px;padding:1px;cursor:pointer}.custom input[type=text]{min-width:0;width:91px;border:1px solid #c8d7df;padding:5px;border-radius:5px;color:#203346;background:white;font-family:Consolas,monospace}.color-error{font-size:12px;color:#a62b38;margin-top:5px}
    </style>
    <div class="toolbar" hidden role="toolbar" aria-label="文字编辑"><button data-highlight="true" title="Ctrl+Q">高亮</button><button data-bold="true" title="Ctrl+B"><b>加粗</b></button><button data-underline="true"><u>下划线</u></button><button data-restore="true" title="清除选中文字上的插件样式">复原</button><div class="palette highlight-palette" role="group" aria-label="高亮颜色"><span class="palette-label">高亮颜色</span></div><div class="palette text-palette" role="group" aria-label="文字颜色"><span class="palette-label">文字颜色</span></div><section class="expanded" hidden aria-label="更多颜色"><div class="expanded-title"></div><div class="color-grid"></div><div class="palette-label">最近使用</div><div class="recent"></div><div class="custom"><label for="custom-color">自定义</label><input id="custom-color" type="color" aria-label="自定义颜色"><input id="hex-color" type="text" maxlength="7" placeholder="#RRGGBB" aria-label="HEX 色值" spellcheck="false"><button data-apply-hex="true">应用</button></div><div class="color-error" role="status" hidden></div></section></div>
    <div class="toast" hidden role="status" aria-live="polite"></div>`;
  document.documentElement.append(host);
  const $ = selector => shadow.querySelector(selector);
  let notes = [], selected = null, currentURL = C.pageKey(location.href), busy = false, timer, toastTimer;
  let enabled = false, activationState = null, loadRevision = 0;
  let editingId = null, fontColor = null;
  let expandedKind = null;
  let recent = { highlight: [], text: [] };
  const histories = new Map();
  const historyFor = url => {
    if (!histories.has(url)) histories.set(url, C.createHistory(chrome.storage.local));
    return histories.get(url);
  };
  let highlightColor = 'yellow';
  function updatePalette() {
    shadow.querySelectorAll('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(C.colorValue('highlight', button.dataset.color) === C.colorValue('highlight', highlightColor))));
    shadow.querySelectorAll('[data-font-color]').forEach(button => button.setAttribute('aria-pressed', String(C.colorValue('text', button.dataset.fontColor) === C.colorValue('text', fontColor))));
    $('[data-highlight]').style.backgroundColor = C.colorValue('highlight', highlightColor);
  }
  for (const [color, { label, value }] of Object.entries(C.COLORS).slice(0, 7)) {
    const button = document.createElement('button'); button.className = 'swatch'; button.dataset.color = color;
    button.style.backgroundColor = value; button.title = label; button.setAttribute('aria-label', label);
    $('.highlight-palette').append(button);
  }
  for (const [color, { label, value }] of Object.entries(C.TEXT_COLORS).slice(0, 7)) {
    const button = document.createElement('button'); button.className = 'swatch'; button.dataset.fontColor = color;
    button.textContent = 'A'; button.style.color = value; button.title = '文字' + label; button.setAttribute('aria-label', '文字' + label);
    $('.text-palette').append(button);
  }
  for (const kind of ['highlight', 'text']) {
    const button = document.createElement('button'); button.className = 'swatch more'; button.dataset.more = kind;
    button.title = kind === 'highlight' ? '更多高亮颜色' : '更多文字颜色'; button.setAttribute('aria-label', button.title); button.setAttribute('aria-expanded', 'false');
    $(kind === 'highlight' ? '.highlight-palette' : '.text-palette').append(button);
  }
  function closeColors() {
    expandedKind = null; $('.expanded').hidden = true;
    shadow.querySelectorAll('[data-more]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function fitToolbar() {
    const toolbar = $('.toolbar'), rect = toolbar.getBoundingClientRect();
    toolbar.style.top = Math.max(8, Math.min(rect.top, innerHeight - rect.height - 8)) + 'px';
  }
  function colorButton(hex, kind) {
    const button = document.createElement('button'); button.className = 'swatch';
    if (kind === 'highlight') { button.dataset.color = hex; button.style.backgroundColor = C.colorValue(kind, hex); }
    else { button.dataset.fontColor = hex; button.style.color = hex; button.textContent = 'A'; }
    button.title = hex; button.setAttribute('aria-label', (kind === 'highlight' ? '高亮 ' : '文字 ') + hex);
    return button;
  }
  function openColors(kind) {
    if (expandedKind === kind) { closeColors(); return; }
    expandedKind = kind; $('.expanded').hidden = false;
    shadow.querySelectorAll('[data-more]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.more === kind)));
    $('.expanded-title').textContent = kind === 'highlight' ? '更多高亮颜色' : '更多文字颜色';
    $('.color-grid').replaceChildren(...(kind === 'highlight' ? C.EXTRA_HIGHLIGHTS : C.EXTRA_TEXT_COLORS).map(hex => colorButton(hex, kind)));
    $('.recent').replaceChildren(...recent[kind].map(hex => colorButton(hex, kind)));
    if (!recent[kind].length) { const label = document.createElement('span'); label.className = 'palette-label'; label.textContent = '暂无使用记录'; $('.recent').append(label); }
    const value = C.colorValue(kind, kind === 'highlight' ? highlightColor : fontColor)?.slice(0, 7) || (kind === 'highlight' ? '#ffdf6e' : '#202124');
    $('#custom-color').value = value; $('#hex-color').value = value; $('.color-error').hidden = true;
    updatePalette(); fitToolbar();
  }
  async function applyColor(kind, color) {
    if (busy) return;
    if (kind === 'highlight') highlightColor = color; else fontColor = color;
    updatePalette();
    if (await annotate(kind === 'highlight' ? { color } : { fontColor: color })) closeColors();
  }
  async function applyHex() {
    const hex = C.normalizeHex($('#hex-color').value);
    if (!hex) { $('.color-error').textContent = '请输入有效色值，例如 #3A7BD5'; $('.color-error').hidden = false; $('#hex-color').focus(); return; }
    if (expandedKind) await applyColor(expandedKind, hex);
  }
  $('#custom-color').onchange = () => run(async () => {
    $('#hex-color').value = $('#custom-color').value;
    if (expandedKind) await applyColor(expandedKind, $('#custom-color').value);
  });
  $('#hex-color').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); run(applyHex); } };
  updatePalette();
  const observer = new MutationObserver(changes => {
    if (changes.some(change => !host.contains(change.target))) schedule();
  });
  const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  function toast(message) { $('.toast').textContent = message; $('.toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('.toast').hidden = true, 3500); }
  function textNodes() {
    const nodes = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        return !p || p.closest('script,style,noscript,textarea,input,select,[contenteditable]:not([contenteditable="false"]),#pagetint-ui') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node, offset = 0;
    while ((node = walker.nextNode())) { nodes.push({ node, start: offset, end: offset + node.length }); offset += node.length; }
    return { nodes, text: nodes.map(n => n.node.data).join('') };
  }
  function capture(showToolbar = true) {
    if (!enabled) return;
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const { nodes, text } = textNodes();
    // Map element-boundary selections as well as text-boundary selections.
    const parts = nodes.filter(n => range.intersectsNode(n.node));
    if (!parts.length) return;
    let start = parts[0].start, end = parts.at(-1).end;
    if (range.startContainer.nodeType === Node.TEXT_NODE) start += range.startOffset;
    if (range.endContainer.nodeType === Node.TEXT_NODE) end = parts.at(-1).start + range.endOffset;
    const exact = text.slice(start, end);
    if (!exact.trim() || exact.length > 20000) return;
    selected = { exact, start, prefix: text.slice(Math.max(0, start - 48), start), suffix: text.slice(end, end + 48) };
    if (!showToolbar) return selected;
    showAt(range.getBoundingClientRect());
    return selected;
  }
  function showAt(rect) {
    $('.toolbar').hidden = false;
    $('.toolbar').style.left = Math.max(8, Math.min(innerWidth - 320, rect.left)) + 'px';
    $('.toolbar').style.top = Math.max(8, Math.min(innerHeight - 220, rect.bottom + 8)) + 'px';
  }
  function restoreSelection(anchor) {
    if (!anchor) return;
    const { nodes, text } = textNodes(), position = C.locate(text, anchor);
    if (!position) return;
    const parts = nodes.filter(n => n.end > position.start && n.start < position.end);
    if (!parts.length) return;
    const range = document.createRange();
    range.setStart(parts[0].node, position.start - parts[0].start);
    range.setEnd(parts.at(-1).node, position.end - parts.at(-1).start);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  function unwrap() {
    document.querySelectorAll('[data-pagetint-id]').forEach(span => {
      const parent = span.parentNode;
      span.replaceWith(...span.childNodes);
      parent.normalize();
    });
  }
  function paint() {
    if (!enabled) return;
    const anchor = isEditing() ? null : capture(false);
    observer.disconnect();
    unwrap();
    for (const note of notes) {
      const { nodes, text } = textNodes();
      const position = C.locate(text, note.anchor);
      if (!position) continue;
      for (const part of nodes.filter(n => n.end > position.start && n.start < position.end).reverse()) {
        const range = document.createRange();
        range.setStart(part.node, Math.max(0, position.start - part.start));
        range.setEnd(part.node, Math.min(part.node.length, position.end - part.start));
        const span = document.createElement('span');
        span.dataset.pagetintId = note.id;
        span.style.setProperty('background-color', C.colorValue('highlight', note.color) || 'transparent', 'important');
        if (note.bold) span.style.setProperty('font-weight', '700', 'important');
        if (note.underline) {
          span.style.setProperty('text-decoration-line', 'underline', 'important');
          span.style.setProperty('text-underline-offset', '0.14em', 'important');
        }
        if (note.fontColor) span.style.setProperty('color', C.colorValue('text', note.fontColor), 'important');
        range.surroundContents(span);
      }
    }
    observe();
    restoreSelection(anchor);
  }
  async function run(fn) { try { await fn(); } catch (error) { toast('操作失败：' + error.message); } }
  async function load() {
    const revision = ++loadRevision;
    const records = await chrome.storage.local.get(null);
    if (revision !== loadRevision) return;
    activationState = A.resolve(document, location.href, records);
    enabled = activationState.enabled;
    notes = Object.entries(records).filter(([key, n]) => key.startsWith(C.PREFIX) && C.validNote(n) && C.pageKey(n.url) === currentURL).map(([, n]) => n).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    if (!enabled) {
      observer.disconnect(); clearTimeout(timer); clearTimeout(toastTimer);
      selected = null; editingId = null; closeColors(); $('.toolbar').hidden = true; $('.toast').hidden = true;
      host.style.setProperty('display', 'none', 'important'); unwrap();
      // Observe late-loading article bodies only in automatic mode; never paint while inactive.
      if (!activationState.blocked && activationState.globalEnabled && activationState.mode === 'auto') observe();
      return;
    }
    host.style.removeProperty('display');
    paint();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => run(load), 600); }
  $('.toolbar').onmousedown = event => { if (!event.target.closest('input,label')) event.preventDefault(); };
  async function annotate(patch = {}) {
    if (!enabled || !selected || busy) return;
    if (C.pageKey(location.href) !== currentURL) { $('.toolbar').hidden = true; toast('课程已切换，请重新选择文字'); return; }
    busy = true;
    try {
      const now = new Date().toISOString();
      const existing = editingId && notes.find(n => n.id === editingId);
      const n = existing ? C.updateMark(existing, patch, now) : C.updateMark({ id: crypto.randomUUID(), url: currentURL, title: document.title, anchor: selected, color: 'none', bold: false, note: '', createdAt: now, updatedAt: now }, patch, now);
      // Do not resurrect a mark deleted by page data management or another tab.
      if (existing && !(await chrome.storage.local.get(C.PREFIX + n.id))[C.PREFIX + n.id]) {
        editingId = null; $('.toolbar').hidden = true; toast('该标记已删除，请重新选择文字'); return;
      }
      if (!enabled) return;
      await historyFor(currentURL).change(C.PREFIX + n.id, n);
      editingId = n.id;
      await load();
      if (patch.color && patch.color !== 'none') {
        highlightColor = patch.color;
        recent.highlight = C.recentColors(recent.highlight, C.colorValue('highlight', patch.color).slice(0, 7));
      }
      if (patch.fontColor) recent.text = C.recentColors(recent.text, C.colorValue('text', patch.fontColor));
      if (patch.color || patch.fontColor) {
        await chrome.storage.local.set({ recentHighlightColors: recent.highlight, recentTextColors: recent.text, highlightColor });
        updatePalette();
      }
      toast('标记已保存 · Ctrl+Z 撤销');
      return true;
    } finally { busy = false; }
  }
  async function undo() {
    if (!enabled || C.pageKey(location.href) !== currentURL) return;
    const changed = await historyFor(currentURL).undo();
    if (changed) { await load(); toast('已撤销上一步'); }
  }
  async function restore() {
    if (!enabled || !selected || busy || C.pageKey(location.href) !== currentURL) return;
    busy = true;
    try {
      const marks = Object.entries(await chrome.storage.local.get(null))
        .filter(([key, n]) => key.startsWith(C.PREFIX) && C.validNote(n) && C.pageKey(n.url) === currentURL).map(([, n]) => n);
      const changes = C.restoreChanges(marks, textNodes().text, selected);
      if (!enabled) return;
      if (!changes.length) { toast('所选文字没有可复原的插件样式'); return; }
      await historyFor(currentURL).changeMany(changes);
      editingId = null; fontColor = null; closeColors(); updatePalette();
      await load();
      toast('已复原所选文字 · Ctrl+Z 撤销');
    } finally { busy = false; }
  }
  function isEditing(event) {
    const path = event?.composedPath() || [shadow.activeElement || document.activeElement];
    return document.designMode === 'on' || path.some(el => el instanceof Element &&
      (el.matches('input,textarea,select,[role="textbox"]') || el.isContentEditable));
  }
  $('.toolbar').onclick = event => run(async () => {
    if (!enabled) return;
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.restore) { await restore(); return; }
    if (button.dataset.more) { openColors(button.dataset.more); return; }
    if (button.dataset.applyHex) { await applyHex(); return; }
    if (button.dataset.color) {
      await applyColor('highlight', button.dataset.color); return;
    }
    if (button.dataset.fontColor) {
      await applyColor('text', button.dataset.fontColor); return;
    }
    await annotate(button.dataset.highlight ? { color: highlightColor } : button.dataset.underline ? { underline: true } : { bold: true });
  });
  document.addEventListener('keydown', event => {
    if (!enabled) return;
    const action = C.shortcut(event);
    if (!action || isEditing(event)) return;
    if (action === 'undo') {
      if (C.pageKey(location.href) !== currentURL || !historyFor(currentURL).canUndo()) return;
      event.preventDefault(); event.stopPropagation(); run(undo); return;
    }
    if (!capture(false)) return;
    editingId = null;
    event.preventDefault(); event.stopPropagation();
    run(() => annotate(action === 'bold' ? { bold: true } : { color: highlightColor }));
  }, true);
  document.addEventListener('mouseup', e => { if (!enabled || e.composedPath().includes(host)) return; closeColors(); $('.toolbar').hidden = true; selected = null; editingId = null; fontColor = null; updatePalette(); if (!isEditing(e)) capture(); });
  document.addEventListener('click', event => {
    if (!enabled || event.composedPath().includes(host) || isEditing(event) || !getSelection()?.isCollapsed || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const candidates = [];
    for (let el = event.target; el instanceof Element; el = el.parentElement) {
      const mark = el.dataset.pagetintId && notes.find(n => n.id === el.dataset.pagetintId);
      if (mark) candidates.push({ mark, el });
    }
    const target = candidates.find(({ mark }) => mark.color !== 'none') || candidates[0];
    if (!target) return;
    event.preventDefault();
    editingId = target.mark.id; selected = target.mark.anchor;
    if (target.mark.color !== 'none') highlightColor = target.mark.color;
    fontColor = target.mark.fontColor || null;
    updatePalette(); showAt(target.el.getBoundingClientRect());
  });
  document.addEventListener('keyup', e => { if (e.key === 'Escape') { if (expandedKind) closeColors(); else $('.toolbar').hidden = true; } else if (e.key === 'Shift') capture(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[A.ENABLED] || changes[A.RULES]) { run(load); return; }
    if (enabled) schedule();
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!['export-obsidian-markdown', 'pagetint-state'].includes(message?.type) || sender.id !== chrome.runtime.id) return;
    (async () => {
      try {
        const records = await chrome.storage.local.get(null);
        const state = A.resolve(document, location.href, records);
        if (message.type === 'pagetint-state') { sendResponse({ ok: true, state }); return; }
        if (!state.enabled) throw new Error(state.reason);
        const url = C.pageKey(location.href);
        const saved = Object.entries(records).filter(([key, n]) => key.startsWith(C.PREFIX) && C.validNote(n) && C.pageKey(n.url) === url).map(([, n]) => n);
        sendResponse({ ok: true, ...globalThis.PageTintExport.exportPage(document, saved) });
      } catch (error) { sendResponse({ ok: false, error: error.message }); }
    })();
    return true;
  });
  // Canonical page identity is shared with data management and legacy record loading.
  setInterval(() => { if (C.pageKey(location.href) !== currentURL) { currentURL = C.pageKey(location.href); selected = null; editingId = null; closeColors(); $('.toolbar').hidden = true; run(load); } }, 700);
  run(async () => {
    const settings = await chrome.storage.local.get(['highlightColor', 'recentHighlightColors', 'recentTextColors']);
    if (C.colorValue('highlight', settings.highlightColor)) highlightColor = settings.highlightColor;
    recent.highlight = C.recentColors(settings.recentHighlightColors, null);
    recent.text = C.recentColors(settings.recentTextColors, null);
    updatePalette(); await load();
  });
})();
