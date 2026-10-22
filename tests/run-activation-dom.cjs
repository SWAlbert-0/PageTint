// Verify activation against real DOM structures and the extension's content/popup flows.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require(process.env.PAGETINT_JSDOM_PATH || 'jsdom');
const root = path.join(__dirname, '..');
const A = require('../activation.js');
const text = '这是用于阅读的完整段落，介绍技术概念、学习方法和使用经验。'.repeat(8);
const paragraphs = `<p>标记原文${text}</p><p>${text}</p><p>${text}</p>`;
const article = `<article><h1>示例文章</h1>${paragraphs}</article>`;
let checks = 0;
function check(html, expected) {
  const dom = new JSDOM(html);
  try { assert.equal(A.isArticle(dom.window.document), expected); checks++; }
  finally { dom.window.close(); }
}
check(article, true);
check(`<main class="markdown-body"><h1>课程文档</h1>${paragraphs}<pre>example()</pre></main>`, true);
check('<main><h1>登录</h1><form><input type="password"></form></main>', false);
check('<main><h1>控制台</h1><table><tr><td>100</td></tr></table></main>', false);
check(`<h1>文章列表</h1>${[1, 2, 3].map(() => `<article><h2>文章摘要</h2>${paragraphs}<a href="/post">阅读更多</a></article>`).join('')}`, false);
check(`<main><h1>文章索引</h1>${[1, 2, 3].map(() => `<p><a href="/post">${text}</a></p>`).join('')}</main>`, false);
check('<meta property="og:type" content="article"><main><h1>加载中</h1></main>', false);
check(`<meta property="og:type" content="article"><div>${paragraphs}</div>`, true);
check(`<script type="application/ld+json">{"@graph":[{"@type":"BlogPosting"}]}</script>${article}`, true);
check(`<script type="application/ld+json">invalid</script><main><h1>加载中</h1></main>`, false);
check(`<main><h1>网页编辑器</h1><textarea></textarea>${paragraphs}</main>`, false);
check(`<article hidden>${paragraphs}</article>`, false);
check(`<main><article data-testid="conversation-turn-1"><h1>对话</h1>${paragraphs}</article></main>`, false);

const mark = { id: 'legacy', url: 'https://example.com/article/', title: '示例文章', note: '', color: 'yellow', bold: true, underline: true, createdAt: '2026', updatedAt: '2026', anchor: { exact: '标记原文', start: 4, prefix: '示例文章', suffix: text.slice(0, 20) } };
function storage(initial) {
  const data = structuredClone(initial), listeners = [];
  return { data, onChanged: { addListener(fn) { listeners.push(fn); } }, local: {
    async get(keys) {
      if (keys === null) return structuredClone(data);
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]));
    },
    async set(values) {
      const changes = {};
      for (const [key, value] of Object.entries(values)) {
        if (JSON.stringify(data[key]) === JSON.stringify(value)) continue;
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) }; data[key] = structuredClone(value);
      }
      if (Object.keys(changes).length) listeners.forEach(fn => fn(changes, 'local'));
    },
    async remove(keys) { keys.forEach(key => delete data[key]); }
  } };
}
function content(html, initial, url = mark.url) {
  const dom = new JSDOM('<!doctype html><title>测试页面</title>' + html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const store = storage(initial), w = dom.window;
  let receiver;
  w.chrome = { storage: store, runtime: { id: 'extension', onMessage: { addListener(fn) { receiver = fn; } } } };
  for (const f of ['core.js', 'activation.js', 'exporter.js', 'content.js']) w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
  return { dom, w, store, message(type, sender = 'extension') { return new Promise(resolve => { if (!receiver || !receiver({ type }, { id: sender }, resolve)) resolve(null); }); } };
}
async function until(fn) {
  for (let i = 0; i < 150; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw Error('Activation did not settle');
}
(async () => {
  for (const url of ['http://127.0.0.1:56001/', 'http://localhost:5173/', 'http://[::1]:56001/']) {
    const host = A.hostname(url);
    const localMark = { ...mark, url };
    const local = content(article, { 'course-note:legacy': localMark, [A.RULES]: { [host]: 'on' } }, url);
    const localPopup = new JSDOM(fs.readFileSync(path.join(root, 'popup.html'), 'utf8'), { url: 'https://extension.test/popup.html', runScripts: 'outside-only' });
    try {
      assert.equal(local.w.document.querySelector('#pagetint-ui'), null);
      assert.equal(local.w.document.querySelector('[data-pagetint-id]'), null);
      const key = new local.w.KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true });
      local.w.document.dispatchEvent(key); assert.equal(key.defaultPrevented, false);
      assert.equal(await local.message('export-obsidian-markdown'), null);
      const w = localPopup.window, $ = selector => w.document.querySelector(selector);
      w.chrome = { storage: local.store, tabs: { async query() { return [{ id: 1, url }]; }, async sendMessage() { throw Error('must not message local page'); } } };
      for (const f of ['core.js', 'activation.js', 'popup.js']) w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
      await until(() => $('#activation-status').textContent.includes('本地页面'));
      assert.equal($('#site-mode').disabled, true);
      assert.equal($('#export-markdown').disabled, true);
      assert.equal(JSON.stringify(local.store.data['course-note:legacy']), JSON.stringify(localMark));
      checks += 7;
    } finally { localPopup.window.close(); local.dom.window.close(); }
  }
  const c = content(article, { 'course-note:legacy': mark });
  try {
    await until(() => c.w.document.querySelector('[data-pagetint-id]'));
    const original = c.w.document.body.textContent;
    assert.equal((await c.message('pagetint-state')).state.enabled, true);
    await c.store.local.set({ [A.ENABLED]: false });
    await until(() => !c.w.document.querySelector('[data-pagetint-id]'));
    assert.equal(c.w.document.body.textContent, original);
    assert.equal(JSON.stringify(c.store.data['course-note:legacy']), JSON.stringify(mark));
    const range = c.w.document.createRange(); range.selectNodeContents(c.w.document.querySelector('p'));
    c.w.getSelection().addRange(range);
    const key = new c.w.KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true });
    c.w.document.dispatchEvent(key); assert.equal(key.defaultPrevented, false);
    assert.equal((await c.message('export-obsidian-markdown')).ok, false);
    await c.store.local.set({ [A.ENABLED]: true });
    await until(() => c.w.document.querySelector('[data-pagetint-id]'));
    await c.store.local.set({ [A.RULES]: { 'example.com': 'off' } });
    await until(() => !c.w.document.querySelector('[data-pagetint-id]'));
    await c.store.local.set({ [A.RULES]: {} });
    await until(() => c.w.document.querySelector('[data-pagetint-id]'));
    assert.equal((await c.message('export-obsidian-markdown')).ok, true);
    assert.equal(await c.message('pagetint-state', 'other-extension'), null);
    checks += 9;

    // A client-side route change must stop editing on a non-article page.
    c.w.history.pushState({}, '', '/dashboard');
    c.w.document.body.innerHTML = '<main><h1>控制台</h1><p>状态列表</p></main>';
    await until(() => !c.w.document.querySelector('[data-pagetint-id]'));
    assert.equal((await c.message('pagetint-state')).state.enabled, false);
    checks++;
  } finally { c.dom.window.close(); }

  const late = content('<main><h1>正在加载</h1></main>', { 'course-note:legacy': mark });
  try {
    assert.equal((await late.message('pagetint-state')).state.enabled, false);
    // Let startup load install its inactive-page observer, then finish loading the article.
    await new Promise(resolve => setTimeout(resolve, 20));
    late.w.document.querySelector('main').innerHTML = article;
    await until(() => late.w.document.querySelector('[data-pagetint-id]'));
    assert.equal((await late.message('pagetint-state')).state.enabled, true);
    checks += 2;
  } finally { late.dom.window.close(); }

  const forced = content('<main><h1>短页面</h1><p>标记原文</p></main>', { 'course-note:legacy': mark, [A.RULES]: { 'example.com': 'on' } });
  const popup = new JSDOM(fs.readFileSync(path.join(root, 'popup.html'), 'utf8'), { url: 'https://extension.test/popup.html', runScripts: 'outside-only' });
  try {
    const w = popup.window, $ = selector => w.document.querySelector(selector);
    w.chrome = { storage: forced.store, tabs: { async query() { return [{ id: 1, url: mark.url }]; }, async sendMessage(id, message) { return forced.message(message.type); } } };
    for (const f of ['core.js', 'activation.js', 'popup.js']) w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
    await until(() => !$('#site-mode').disabled);
    assert.equal($('#site-mode').value, 'on');
    await until(() => !$('#export-markdown').disabled);
    $('#enabled-toggle').checked = false; await $('#enabled-toggle').onchange();
    assert.equal(forced.store.data[A.ENABLED], false);
    assert.equal($('#export-markdown').disabled, true);
    assert.equal($('#site-mode').disabled, true);
    $('#enabled-toggle').checked = true; await $('#enabled-toggle').onchange();
    $('#site-mode').value = 'off'; await $('#site-mode').onchange();
    assert.equal(forced.store.data[A.RULES]['example.com'], 'off');
    assert.equal($('#export-markdown').disabled, true);
    $('#site-mode').value = 'auto'; await $('#site-mode').onchange();
    assert.equal(Object.hasOwn(forced.store.data[A.RULES], 'example.com'), false);
    assert.equal($('#export-markdown').disabled, true);
    assert.equal(JSON.stringify(forced.store.data['course-note:legacy']), JSON.stringify(mark));
    checks += 9;
  } finally { popup.window.close(); forced.dom.window.close(); }
  console.log(`PASS: ${checks} activation DOM and integration checks`);
})().catch(error => { console.error(error); process.exitCode = 1; });
