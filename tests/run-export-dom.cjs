// Optional DOM integration test; jsdom is only used for development, never bundled.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.PAGETINT_JSDOM_PATH || 'jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(__dirname, 'export-browser.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/book/chapter3/#heading', runScripts: 'outside-only' });
try {
  for (const file of ['core.js', 'exporter.js']) dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  const script = [...dom.window.document.scripts].find(script => !script.src);
  dom.window.eval(script.textContent);
  const output = dom.window.document.getElementById('result').textContent;
  console.log(output.split('\n')[0].replace('browser', 'DOM'));
  if (dom.window.document.body.dataset.testResult !== 'pass') process.exitCode = 1;
} finally { dom.window.close(); }

// Exercise the extension's content-message -> popup -> manual download path.
(async () => {
  const article = new JSDOM('<!doctype html><title>导出课程</title><article><h1>导出课程</h1><p>完整正文和其余文字</p></article>', {
    url: 'https://example.com/book/chapter3/#section', runScripts: 'outside-only'
  });
  const popup = new JSDOM(fs.readFileSync(path.join(root, 'popup.html'), 'utf8'), {
    url: 'chrome-extension://test-extension/popup.html', runScripts: 'outside-only'
  });
  try {
    const records = { pagetintSiteRules: { 'example.com': 'on' }, 'course-note:a': { id: 'a', url: 'https://example.com/book/chapter3/#other', title: '导出课程', note: '', color: '#aabbcc', fontColor: 'blue', bold: true, underline: true, createdAt: '2026', updatedAt: '2026', anchor: { exact: '完整正文', start: 4, prefix: '导出课程', suffix: '和其余文字' } } };
    let receiver, downloaded, payload;
    const storage = {
      local: { async get(keys) { if (keys === null) return structuredClone(records); return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, records[key]])); } },
      onChanged: { addListener() {} }
    };
    article.window.chrome = { storage, runtime: { id: 'test-extension', onMessage: { addListener(fn) { receiver = fn; } } } };
    for (const file of ['core.js', 'activation.js', 'exporter.js', 'content.js']) article.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    popup.window.chrome = { storage, tabs: {
      async query() { return [{ id: 1, url: article.window.location.href }]; },
      sendMessage(id, message) { return new Promise(resolve => receiver(message, { id: 'test-extension' }, resolve)); }
    } };
    popup.window.Blob = Blob;
    popup.window.URL.createObjectURL = blob => { payload = blob; return 'blob:test-download'; };
    popup.window.URL.revokeObjectURL = () => {};
    popup.window.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
    for (const file of ['core.js', 'activation.js', 'popup.js']) popup.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    for (let i = 0; i < 100 && popup.window.document.getElementById('export-markdown').disabled; i++) await new Promise(resolve => setTimeout(resolve, 5));
    popup.window.document.getElementById('export-markdown').click();
    for (let i = 0; i < 100 && !downloaded; i++) await new Promise(resolve => setTimeout(resolve, 5));
    if (!downloaded) throw Error('No Markdown download: ' + popup.window.document.getElementById('status').textContent);
    const markdown = await payload.text();
    if (downloaded !== '导出课程.md' || !markdown.includes('background-color:#aabbcc99;color:#245ec7;font-weight:700;text-decoration:underline')) throw Error('Saved styles not exported through messaging');
    if (!markdown.includes('和其余文字')) throw Error('Full text missing');
    console.log('PASS: content message, legacy marks and full-text download');
  } finally { article.window.close(); popup.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
