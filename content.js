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
    *{box-sizing:border-box}button,input,textarea{font:inherit}button{cursor:pointer;border:1px solid #c8d7df;border-radius:7px;background:#fff;color:#203346;padding:6px 10px;transition:background-color .15s,border-color .15s,box-shadow .15s}button:hover{background:#e8f3f5}button:disabled{cursor:default;opacity:.5}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #087e8b;outline-offset:2px}
    [hidden]{display:none!important}.toolbar,.toast{pointer-events:auto;background:#fff;box-shadow:0 12px 36px #20334624,0 2px 8px #20334612;border:1px solid #d3e0e3}
    .toolbar{position:fixed;display:flex;gap:9px;padding:10px;border-radius:12px;width:356px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;flex-wrap:wrap;align-items:center}.actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;width:100%;padding:3px;background:#f1f5f5;border:1px solid #e1e9ea;border-radius:9px}.actions button{min-width:0;min-height:32px;padding:5px 3px;border-color:transparent;background:transparent;border-radius:6px;font-size:13px;white-space:nowrap}.actions button:hover{background:#fff;box-shadow:0 1px 4px #20334614}.actions [data-restore]:hover{color:#973c2a;background:#fff3f0}.palette{display:flex;gap:6px;flex-wrap:wrap;width:100%;padding:0 2px;align-items:center}.palette-label{width:100%;font-size:11px;line-height:1.4;color:#687c85;letter-spacing:.04em}.swatch{width:30px;height:27px;padding:0;border-color:transparent;border-radius:6px}.swatch:hover{box-shadow:0 0 0 2px #fff,0 0 0 3px #9fc4ca}.swatch[aria-pressed="true"]{outline:2px solid #087e8b;outline-offset:1px}
    .toast{position:fixed;left:50%;bottom:25px;transform:translateX(-50%);padding:10px 18px;border-radius:9px;max-width:90vw}
    .comment-view{position:fixed;pointer-events:auto;width:360px;max-width:calc(100vw - 16px);max-height:min(280px,calc(100vh - 16px));overflow:auto;padding:12px 14px;border:1px solid #c9dcdf;border-left:3px solid #087e8b;border-radius:10px;background:#fff;color:#203346;box-shadow:0 12px 34px #20334626,0 2px 8px #20334612;font-size:13px;line-height:1.7;scrollbar-width:thin;scrollbar-color:#aac5c9 transparent}.comment-view .comment-math-display{margin:10px 0}.comment-view .comment-math-error{padding:2px 4px;border-radius:4px}
    .swatch{position:relative}.swatch[aria-pressed="true"]::after{content:'✓';position:absolute;right:-3px;top:-6px;border-radius:50%;background:#fff;color:#203346;font-size:11px;line-height:14px;width:14px;text-align:center;box-shadow:0 1px 3px #20334626}.more,.more:hover{background:conic-gradient(#ff9292,#ffdf79,#9bdfad,#8bcfff,#c9a2ed,#ff9292);color:#203346;font-size:20px;font-weight:700;text-shadow:0 1px 2px #fff}.expanded{width:100%;border-top:1px solid #e1e9ea;padding:10px 2px 0}.expanded-title{font-size:12px;color:#59717d;margin-bottom:7px}.color-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:7px 0 10px}.color-grid .swatch{width:100%;max-width:30px;min-width:0;justify-self:center}.recent{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 12px}.custom{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.custom label{font-size:12px}.custom input[type=color]{width:30px;height:29px;border:1px solid #c8d7df;background:#fff;border-radius:5px;padding:1px;cursor:pointer}.custom input[type=text]{min-width:0;width:91px;border:1px solid #c8d7df;padding:5px;border-radius:5px;color:#203346;background:#fff;font-family:Consolas,monospace}.color-error{font-size:12px;color:#a62b38;margin-top:5px}
    [data-comment].has-comment{border-color:#9fc4ca;background:#e3f1f2;color:#076570;font-weight:700}.comment-editor{width:100%;border-top:1px solid #e1e9ea;padding:11px 2px 0}.comment-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.comment-heading strong{font-size:14px}.comment-heading span{font-size:11px;color:#687c85}.comment-quote{margin:8px 0;padding:6px 9px;border-left:3px solid #76b7bf;border-radius:0 5px 5px 0;background:#f4f8f8;color:#59717d;font-size:12px;max-height:60px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.comment-editor textarea{display:block;width:100%;min-height:88px;max-height:220px;resize:vertical;border:1px solid #c3d5d9;border-radius:8px;padding:8px 9px;color:#203346;background:#fff;line-height:1.6}.comment-editor textarea:focus{border-color:#087e8b}.comment-preview-label{font-size:11px;color:#687c85;margin:8px 0 4px}.comment-preview{min-height:38px;max-height:180px;overflow:auto;padding:8px 10px;background:#f4f8f8;border:1px solid #e7eeee;border-radius:8px;overflow-wrap:anywhere}.comment-text{white-space:pre-wrap}.comment-math{display:inline-block;max-width:100%;vertical-align:middle}.comment-math-display{display:block;overflow-x:auto;margin:8px 0;text-align:center}.comment-math-error{color:#a62b38;background:#fff0ed;white-space:pre-wrap}.comment-error{color:#a62b38;font-size:12px;margin-top:5px}.comment-actions{display:flex;gap:6px;margin-top:9px}.comment-actions [data-save-comment]{background:#087e8b;border-color:#087e8b;color:#fff}.comment-actions [data-save-comment]:hover{background:#076570}.comment-actions [data-delete-comment]{color:#a62b38}.comment-actions [data-cancel-comment]{margin-left:auto}
    .toolbar.comment-open{flex-wrap:nowrap;flex-direction:column;align-items:stretch;overflow:hidden}.comment-open>.actions{flex:0 0 auto}.comment-open>.palette{display:none}.comment-open>.comment-editor{flex:1 1 auto;min-height:0;max-height:calc(100vh - 96px);display:flex;flex-direction:column;overflow:hidden}.comment-open .comment-heading,.comment-open .comment-preview-label,.comment-open .comment-error,.comment-open .comment-actions{flex-shrink:0}.comment-open .comment-quote{flex:0 1 auto;min-height:0}.comment-open textarea{flex:0 1 130px;min-height:64px;max-height:160px}.comment-open .comment-preview{flex:1 1 120px;min-height:48px;max-height:none}.comment-open .comment-actions{margin-top:8px;padding-top:8px;border-top:1px solid #e1e9ea;background:#fff}
    @media(max-height:520px){.comment-open .comment-quote,.comment-open .comment-heading span{display:none}.comment-open textarea{min-height:52px}.comment-open .comment-preview{min-height:36px}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
    </style>
    <div class="toolbar" hidden role="toolbar" aria-label="文字编辑"><div class="actions" role="group" aria-label="文字操作"><button data-highlight="true" title="Ctrl+Q">高亮</button><button data-bold="true" title="Ctrl+B"><b>加粗</b></button><button data-underline="true"><u>下划线</u></button><button data-comment="true" title="为选中文字添加批注和 TeX 公式">批注</button><button data-restore="true" title="清除选中文字上的插件样式">复原</button></div><div class="palette highlight-palette" role="group" aria-label="高亮颜色"><span class="palette-label">高亮颜色</span></div><div class="palette text-palette" role="group" aria-label="文字颜色"><span class="palette-label">文字颜色</span></div><section class="expanded" hidden aria-label="更多颜色"><div class="expanded-title"></div><div class="color-grid"></div><div class="palette-label">最近使用</div><div class="recent"></div><div class="custom"><label for="custom-color">自定义</label><input id="custom-color" type="color" aria-label="自定义颜色"><input id="hex-color" type="text" maxlength="7" placeholder="#RRGGBB" aria-label="HEX 色值" spellcheck="false"><button data-apply-hex="true">应用</button></div><div class="color-error" role="status" hidden></div></section><section class="comment-editor" hidden aria-label="批注编辑"><div class="comment-heading"><strong>批注</strong><span>$行内$ · $$块级$$ · TeX</span></div><blockquote class="comment-quote"></blockquote><textarea id="comment-input" maxlength="20000" placeholder="写下批注，公式如 $E=mc^2$" aria-label="批注内容" spellcheck="true"></textarea><div class="comment-preview-label">预览</div><div class="comment-preview"></div><div class="comment-error" role="status" hidden></div><div class="comment-actions"><button data-save-comment="true">保存批注</button><button data-delete-comment="true" hidden>删除批注</button><button data-cancel-comment="true">取消</button></div></section></div>
    <div class="comment-view" hidden role="tooltip"><div class="comment-view-content"></div></div>
    <div class="toast" hidden role="status" aria-live="polite"></div>`;
  document.documentElement.append(host);
  const $ = selector => shadow.querySelector(selector);
  let notes = [], selected = null, currentURL = C.pageKey(location.href), busy = false, timer, toastTimer;
  let enabled = false, activationState = null, loadRevision = 0;
  let editingId = null, fontColor = null, currentTextColor = 'red';
  let expandedKind = null;
  let commentHoverId = null, commentHoverTarget = null, commentHoverTimer, commentViewHideTimer;
  let recent = { highlight: [], text: [] };
  let preferences = C.normalizePreferences();
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
  function updateShortcutHints() {
    $('[data-highlight]').title = '高亮 · ' + preferences.shortcuts.highlight;
    $('[data-bold]').title = '加粗 · ' + preferences.shortcuts.bold;
    $('.text-palette .palette-label').textContent = '文字颜色 · ' + preferences.shortcuts.fontColor;
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
  function commentMark() { return editingId && notes.find(note => note.id === editingId); }
  function updateCommentButton() {
    const hasComment = Boolean(commentMark()?.note.trim()), button = $('[data-comment]');
    button.classList.toggle('has-comment', hasComment);
    button.textContent = hasComment ? '批注 •' : '批注';
    button.title = hasComment ? '查看或编辑已有批注' : '为选中文字添加批注和 TeX 公式';
  }
  function closeComment() {
    $('.comment-editor').hidden = true; $('.comment-error').hidden = true;
    $('.toolbar').classList.remove('comment-open');
  }
  function hideCommentView() {
    clearTimeout(commentHoverTimer); clearTimeout(commentViewHideTimer);
    commentHoverTimer = undefined; commentHoverId = null; commentHoverTarget = null;
    $('.comment-view').hidden = true; $('.comment-view-content').replaceChildren();
  }
  function scheduleHideCommentView() {
    clearTimeout(commentHoverTimer); commentHoverTimer = undefined;
    clearTimeout(commentViewHideTimer);
    commentViewHideTimer = setTimeout(hideCommentView, 160);
  }
  function showCommentView(note, target) {
    const panel = $('.comment-view');
    globalThis.PageTintComments.render($('.comment-view-content'), note.note);
    panel.hidden = false;
    const rect = target.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
    panel.style.left = Math.max(8, Math.min(innerWidth - width - 8, rect.left)) + 'px';
    const below = rect.bottom + 8;
    panel.style.top = (below + height <= innerHeight - 8 ? below : Math.max(8, rect.top - height - 8)) + 'px';
  }
  function queueCommentView(target) {
    const note = notes.find(item => item.id === target.dataset.pagetintId && item.note.trim());
    if (!note || preferences.commentHoverDelay === 0) { hideCommentView(); return; }
    clearTimeout(commentViewHideTimer);
    if (commentHoverId === note.id && (commentHoverTimer || !$('.comment-view').hidden)) return;
    hideCommentView();
    commentHoverId = note.id; commentHoverTarget = target;
    commentHoverTimer = setTimeout(() => {
      commentHoverTimer = undefined;
      const current = notes.find(item => item.id === commentHoverId && item.note.trim());
      const target = commentHoverTarget?.isConnected ? commentHoverTarget : document.querySelector(`[data-pagetint-comment][data-pagetint-id="${commentHoverId}"]`);
      commentHoverTarget = target;
      if (enabled && current && target) showCommentView(current, target);
    }, preferences.commentHoverDelay);
  }
  $('.comment-view').onmouseenter = () => clearTimeout(commentViewHideTimer);
  $('.comment-view').onmouseleave = hideCommentView;
  function previewComment() {
    const errors = globalThis.PageTintComments.render($('.comment-preview'), $('#comment-input').value);
    $('.comment-error').textContent = errors.length ? '公式无法渲染：' + errors[0].message : '';
    $('.comment-error').hidden = !errors.length;
    return errors;
  }
  function openComment() {
    if (!selected) return;
    hideCommentView(); closeColors();
    const mark = commentMark();
    $('#comment-input').value = mark?.note || '';
    $('.comment-quote').textContent = selected.exact;
    $('[data-delete-comment]').hidden = !mark?.note;
    $('.comment-editor').hidden = false;
    $('.toolbar').classList.add('comment-open');
    previewComment(); fitToolbar(); $('#comment-input').focus();
  }
  async function saveComment() {
    const value = $('#comment-input').value.trim();
    if (!value) { $('.comment-error').textContent = '请输入批注内容'; $('.comment-error').hidden = false; $('#comment-input').focus(); return; }
    if (previewComment().length) { $('#comment-input').focus(); return; }
    if (await annotate({ note: value })) { closeComment(); updateCommentButton(); restoreSelection(selected); }
  }
  async function deleteComment() {
    const existing = commentMark();
    if (!enabled || !existing?.note || busy || C.pageKey(location.href) !== currentURL) return;
    busy = true;
    try {
      const key = C.PREFIX + existing.id;
      if (!(await chrome.storage.local.get(key))[key]) throw new Error('该标记已删除，请重新选择文字');
      const commentOnly = existing.color === 'none' && !existing.bold && !existing.underline && !existing.fontColor;
      await historyFor(currentURL).change(key, commentOnly ? undefined : C.updateMark(existing, { note: '' }));
      closeComment();
      if (commentOnly) { editingId = null; selected = null; $('.toolbar').hidden = true; }
      await load(); updateCommentButton(); toast(`批注已删除 · ${preferences.shortcuts.undo} 撤销`);
    } finally { busy = false; }
  }
  $('#comment-input').oninput = previewComment;
  $('#comment-input').onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeComment(); restoreSelection(selected); }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(saveComment); }
  };
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
    if (kind === 'highlight') highlightColor = color;
    else { fontColor = color; currentTextColor = color; }
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
    const toolbar = $('.toolbar');
    toolbar.hidden = false;
    const width = toolbar.getBoundingClientRect().width;
    toolbar.style.left = Math.max(8, Math.min(innerWidth - width - 8, rect.left)) + 'px';
    toolbar.style.top = Math.max(8, Math.min(innerHeight - 220, rect.bottom + 8)) + 'px';
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
        if (note.note.trim()) {
          span.dataset.pagetintComment = 'true';
          span.style.setProperty('border-bottom', '2px dotted #087e8b', 'important');
        }
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
    updateCommentButton();
    if (commentHoverId && !$('.comment-view').hidden) {
      const current = notes.find(item => item.id === commentHoverId && item.note.trim());
      const target = current && document.querySelector(`[data-pagetint-comment][data-pagetint-id="${commentHoverId}"]`);
      if (current && target) { commentHoverTarget = target; showCommentView(current, target); } else hideCommentView();
    }
    if (!enabled) {
      hideCommentView();
      observer.disconnect(); clearTimeout(timer); clearTimeout(toastTimer);
      selected = null; editingId = null; closeColors(); closeComment(); $('.toolbar').hidden = true; $('.toast').hidden = true;
      host.style.setProperty('display', 'none', 'important'); unwrap();
      // Observe late-loading article bodies only in automatic mode; never paint while inactive.
      if (!activationState.blocked && activationState.globalEnabled && activationState.mode === 'auto') observe();
      return;
    }
    host.style.removeProperty('display');
    paint();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => run(load), 600); }
  $('.toolbar').onmousedown = event => { if (!event.target.closest('input,textarea,label')) event.preventDefault(); };
  async function annotate(patch = {}) {
    if (!enabled || !selected || busy) return;
    if (C.pageKey(location.href) !== currentURL) { $('.toolbar').hidden = true; toast('课程已切换，请重新选择文字'); return; }
    busy = true;
    try {
      const now = new Date().toISOString();
      const existing = editingId && notes.find(n => n.id === editingId);
      const n = existing ? C.updateMark(existing, patch, now) : C.updateMark({ id: C.createId(), url: currentURL, title: document.title, anchor: selected, color: 'none', bold: false, note: '', createdAt: now, updatedAt: now }, patch, now);
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
      if (patch.fontColor) { currentTextColor = patch.fontColor; recent.text = C.recentColors(recent.text, C.colorValue('text', patch.fontColor)); }
      if (patch.color || patch.fontColor) {
        await chrome.storage.local.set({ recentHighlightColors: recent.highlight, recentTextColors: recent.text, highlightColor, textColor: currentTextColor });
        updatePalette();
      }
      toast(`${Object.hasOwn(patch, 'note') ? '批注已保存' : '标记已保存'} · ${preferences.shortcuts.undo} 撤销`);
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
      editingId = null; fontColor = null; closeColors(); closeComment(); updatePalette(); updateCommentButton();
      await load();
      toast(`已复原所选文字 · ${preferences.shortcuts.undo} 撤销`);
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
    if (button.dataset.comment) { openComment(); return; }
    if (button.dataset.saveComment) { await saveComment(); return; }
    if (button.dataset.deleteComment) { await deleteComment(); return; }
    if (button.dataset.cancelComment) { closeComment(); restoreSelection(selected); return; }
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
    const action = C.shortcut(event, preferences.shortcuts);
    if (!action || isEditing(event)) return;
    if (action === 'undo') {
      if (C.pageKey(location.href) !== currentURL || !historyFor(currentURL).canUndo()) return;
      event.preventDefault(); event.stopPropagation(); run(undo); return;
    }
    if (!capture(false)) return;
    editingId = null;
    event.preventDefault(); event.stopPropagation();
    run(() => action === 'fontColor' ? applyColor('text', currentTextColor) : annotate(action === 'bold' ? { bold: true } : { color: highlightColor }));
  }, true);
  document.addEventListener('mouseover', event => {
    if (!enabled || event.composedPath().includes(host)) return;
    const target = event.target instanceof Element ? event.target.closest('[data-pagetint-comment]') : null;
    if (target) queueCommentView(target); else scheduleHideCommentView();
  });
  document.documentElement.addEventListener('mouseleave', scheduleHideCommentView);
  document.addEventListener('scroll', event => { if (!event.composedPath().includes(host)) hideCommentView(); }, true);
  document.addEventListener('mouseup', e => { if (!enabled || e.composedPath().includes(host)) return; hideCommentView(); closeColors(); closeComment(); $('.toolbar').hidden = true; selected = null; editingId = null; fontColor = null; updatePalette(); updateCommentButton(); if (!isEditing(e)) capture(); });
  document.addEventListener('click', event => {
    hideCommentView();
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
    updatePalette(); updateCommentButton(); showAt(target.el.getBoundingClientRect());
  });
  document.addEventListener('keyup', e => { if (e.key === 'Escape') { if (expandedKind) closeColors(); else if (!$('.comment-editor').hidden) closeComment(); else if (!$('.comment-view').hidden) hideCommentView(); else $('.toolbar').hidden = true; } else if (e.key === 'Shift') capture(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[C.PREFERENCES]) {
      preferences = C.normalizePreferences(changes[C.PREFERENCES].newValue);
      updateShortcutHints(); hideCommentView();
      if (Object.keys(changes).length === 1) return;
    }
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
  setInterval(() => { if (C.pageKey(location.href) !== currentURL) { currentURL = C.pageKey(location.href); selected = null; editingId = null; hideCommentView(); closeColors(); closeComment(); updateCommentButton(); $('.toolbar').hidden = true; run(load); } }, 700);
  run(async () => {
    const settings = await chrome.storage.local.get(['highlightColor', 'textColor', 'recentHighlightColors', 'recentTextColors', C.PREFERENCES]);
    preferences = C.normalizePreferences(settings[C.PREFERENCES]);
    if (C.colorValue('text', settings.textColor)) currentTextColor = settings.textColor;
    updateShortcutHints();
    if (C.colorValue('highlight', settings.highlightColor)) highlightColor = settings.highlightColor;
    recent.highlight = C.recentColors(settings.recentHighlightColors, null);
    recent.text = C.recentColors(settings.recentTextColors, null);
    updatePalette(); await load();
  });
})();
