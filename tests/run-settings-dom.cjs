const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require(process.env.PAGETINT_JSDOM_PATH || 'jsdom');
const root = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'migration.html'), 'utf8'), {
  url: 'chrome-extension://settings/migration.html', runScripts: 'outside-only', pretendToBeVisual: true
});
(async () => {
  const w = dom.window, data = {};
  w.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return structuredClone(data);
          return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]));
        },
        async set(values) { Object.assign(data, structuredClone(values)); },
        async remove(keys) { for (const key of keys) delete data[key]; }
      },
      onChanged: { addListener() {} }
    },
    runtime: { id: 'settings', getManifest() { return { name: 'PageTint', version: '0.11.0' }; } }
  };
  for (const file of ['core.js', 'migration.js', 'settings.js', 'migration-page.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  const $ = selector => w.document.querySelector(selector);
  const until = async fn => {
    for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw Error('Settings did not settle');
  };
  await until(() => $('[data-shortcut="bold"]').textContent === 'Ctrl+B' && $('#identity').textContent.includes('PageTint'));
  assert.equal($('#comment-hover-delay').value, '2000');
  assert.equal($('[data-shortcut="fontColor"]').textContent, 'Alt+C');
  $('#comment-hover-delay').value = '500';
  $('[data-shortcut="bold"]').click();
  const key = new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
  $('[data-shortcut="bold"]').dispatchEvent(key);
  assert.equal(key.defaultPrevented, true);
  assert.equal($('[data-shortcut="bold"]').textContent, 'Ctrl+Shift+K');
  await $('#save-preferences').onclick();
  assert.equal(data.pagetintPreferences.commentHoverDelay, 500);
  assert.equal(data.pagetintPreferences.shortcuts.bold, 'Ctrl+Shift+K');
  assert.match($('#settings-status').textContent, /已保存/);

  $('[data-shortcut="highlight"]').click();
  $('[data-shortcut="highlight"]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  await $('#save-preferences').onclick();
  assert.match($('#settings-status').textContent, /同一组/);
  assert.equal(data.pagetintPreferences.shortcuts.highlight, 'Ctrl+Q');

  $('[data-shortcut="highlight"]').click();
  $('[data-shortcut="highlight"]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));
  assert.match($('#settings-status').textContent, /常用浏览器/);
  assert.equal(data.pagetintPreferences.shortcuts.highlight, 'Ctrl+Q');

  $('#reset-preferences').click();
  assert.equal($('#comment-hover-delay').value, '2000');
  assert.equal($('[data-shortcut="bold"]').textContent, 'Ctrl+B');
  await $('#save-preferences').onclick();
  assert.deepEqual(data.pagetintPreferences, { commentHoverDelay: 2000, shortcuts: { bold: 'Ctrl+B', highlight: 'Ctrl+Q', fontColor: 'Alt+C', undo: 'Ctrl+Z' } });
  console.log('PASS: 14 settings DOM, shortcut capture, validation, save and reset checks');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => dom.window.close());
