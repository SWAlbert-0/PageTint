(() => {
  'use strict';
  const C = globalThis.PageTint;
  const $ = selector => document.querySelector(selector);
  const buttons = [...document.querySelectorAll('[data-shortcut]')];
  const reserved = new Set(['Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+F', 'Ctrl+P', 'Ctrl+S', 'Ctrl+T', 'Ctrl+W', 'Ctrl+N', 'Ctrl+R', 'Ctrl+L', 'Ctrl+D', 'Ctrl+J', 'Ctrl+U', 'Ctrl+Shift+I', 'Ctrl+Shift+J']);
  let draft = C.normalizePreferences(), capturing = null, saving = false;
  function message(text, kind = 'info') { $('#settings-status').textContent = text; $('#settings-status').dataset.kind = kind; }
  function renderShortcuts() {
    for (const button of buttons) {
      button.textContent = capturing === button.dataset.shortcut ? '请按组合键…' : draft.shortcuts[button.dataset.shortcut];
      button.classList.toggle('is-capturing', capturing === button.dataset.shortcut);
      button.setAttribute('aria-pressed', String(capturing === button.dataset.shortcut));
    }
  }
  function render() {
    $('#comment-hover-delay').value = String(draft.commentHoverDelay);
    renderShortcuts();
  }
  function stopCapture() { capturing = null; renderShortcuts(); }
  for (const button of buttons) {
    button.onclick = () => { capturing = capturing === button.dataset.shortcut ? null : button.dataset.shortcut; renderShortcuts(); message(capturing ? '请按下新的组合键，按 Escape 取消。' : ''); };
    button.onkeydown = event => {
      if (capturing !== button.dataset.shortcut) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { stopCapture(); message('已取消录入，快捷键尚未修改。'); return; }
      if (event.repeat) return;
      const combo = C.shortcutFromEvent(event);
      if (!combo) { message('请输入字母、数字或 F1–F12，并包含 Ctrl 或 Alt；不支持单独使用修饰键。', 'error'); return; }
      if (reserved.has(combo)) { message(combo + ' 是常用浏览器或系统快捷键，请换一组。', 'error'); return; }
      draft.shortcuts[capturing] = combo; stopCapture(); message('已录入 ' + combo + '，点击“保存阅读设置”后生效。');
    };
    button.onblur = () => { if (capturing === button.dataset.shortcut) stopCapture(); };
  }
  $('#save-preferences').onclick = async () => {
    if (saving) return;
    const values = Object.values(draft.shortcuts);
    if (new Set(values).size !== values.length) { message('各操作不能使用同一组快捷键，请修改后再保存。', 'error'); return; }
    saving = true; $('#save-preferences').disabled = $('#reset-preferences').disabled = true;
    try {
      draft.commentHoverDelay = Number($('#comment-hover-delay').value);
      const preferences = C.normalizePreferences(draft);
      await chrome.storage.local.set({ [C.PREFERENCES]: preferences });
      draft = preferences; render(); message('阅读设置已保存，已打开的文章会立即使用新设置。', 'success');
    } catch (error) { message('保存失败：' + error.message, 'error'); }
    finally { saving = false; $('#save-preferences').disabled = $('#reset-preferences').disabled = false; }
  };
  $('#reset-preferences').onclick = () => {
    stopCapture(); draft = C.normalizePreferences(); render();
    message('已填入默认设置，点击“保存阅读设置”后生效。');
  };
  chrome.storage.local.get(C.PREFERENCES).then(records => { draft = C.normalizePreferences(records[C.PREFERENCES]); render(); })
    .catch(error => message('读取设置失败：' + error.message, 'error'));
  render();
})();
