'use strict';
const C = globalThis.PageTint;
const A = globalThis.PageTintActivation;
const $ = selector => document.querySelector(selector);
let deleting = false;
let controlsBusy = false, exporting = false, pageEnabled = false, siteHostname = null, activationRevision = 0;
function status(message, kind = 'info') { $('#status').textContent = message; $('#status').dataset.kind = kind; }
async function run(fn) { try { await fn(); } catch (error) { status('操作失败：' + error.message, 'error'); } }
async function loadActivation(records) {
  const revision = ++activationRevision;
  const globalEnabled = records[A.ENABLED] !== false;
  $('#enabled-toggle').checked = globalEnabled;
  $('#enabled-toggle').disabled = controlsBusy;
  $('#site-mode').disabled = true;
  siteHostname = null; pageEnabled = false;
  $('#export-markdown').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (revision !== activationRevision) return;
    siteHostname = A.hostname(tab?.url);
    $('#site-host').textContent = siteHostname || '当前页面';
    $('#site-host').title = siteHostname || '';
    $('#site-mode').value = siteHostname ? A.modeFor(records, siteHostname) : 'auto';
    $('#site-mode').disabled = controlsBusy || !globalEnabled || !siteHostname || A.isLocalHost(siteHostname);
    if (!siteHostname || !tab?.id) { $('#activation-status').textContent = '此页面不支持网页编辑'; return; }
    if (A.isLocalHost(siteHostname)) { $('#activation-status').textContent = '本地页面不启用 PageTint'; return; }
    if (!globalEnabled) { $('#activation-status').textContent = '插件已暂停，已有数据仍保留'; return; }
    if (A.modeFor(records, siteHostname) === 'off') { $('#activation-status').textContent = '已在此网站停用'; return; }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'pagetint-state' });
    if (revision !== activationRevision) return;
    if (!response?.ok || !response.state) throw new Error('无法读取启用状态');
    pageEnabled = response.state.enabled;
    $('#activation-status').textContent = response.state.reason;
  } catch {
    if (revision !== activationRevision) return;
    $('#activation-status').textContent = '请刷新网页，并确认已允许插件访问该网站';
  } finally {
    if (revision === activationRevision) $('#export-markdown').disabled = exporting || !pageEnabled;
  }
}
$('#enabled-toggle').onchange = () => run(async () => {
  controlsBusy = true; $('#enabled-toggle').disabled = $('#site-mode').disabled = true;
  try { await chrome.storage.local.set({ [A.ENABLED]: $('#enabled-toggle').checked }); }
  finally { controlsBusy = false; await load(); }
});
$('#site-mode').onchange = () => run(async () => {
  const hostname = siteHostname, mode = $('#site-mode').value;
  if (!hostname || A.isLocalHost(hostname)) return;
  controlsBusy = true; $('#enabled-toggle').disabled = $('#site-mode').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (A.hostname(tab?.url) !== hostname) throw new Error('网页已切换，请重新选择网站设置');
    const records = await chrome.storage.local.get(A.RULES);
    const previous = records[A.RULES];
    const rules = previous && typeof previous === 'object' && !Array.isArray(previous) ? { ...previous } : {};
    if (mode === 'auto') delete rules[hostname]; else Object.defineProperty(rules, hostname, { value: mode, enumerable: true, configurable: true, writable: true });
    await chrome.storage.local.set({ [A.RULES]: rules });
  } finally { controlsBusy = false; await load(); }
});
$('#export-markdown').onclick = () => run(async () => {
  exporting = true;
  const button = $('#export-markdown'); button.disabled = true;
  status('正在提取当前页正文…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('请在普通网页中打开文章后再导出');
    let result;
    try { result = await chrome.tabs.sendMessage(tab.id, { type: 'export-obsidian-markdown' }); }
    catch { throw new Error('暂时无法读取正文，请重新加载扩展并刷新原网页，确认已允许访问该网站'); }
    if (!result?.ok) throw new Error(result?.error || '正文提取失败');
    const url = URL.createObjectURL(new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = result.filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('已发起下载，将 .md 文件放入 Obsidian 仓库即可。' + (result.warnings.length ? '\n注意：' + result.warnings.join('；') : ''), result.warnings.length ? 'info' : 'success');
  } finally { exporting = false; button.disabled = !pageEnabled; }
});
async function load() {
  const records = await chrome.storage.local.get(null);
  const pages = C.groupPages(records);
  $('#summary').textContent = `已保存 ${pages.length} 个页面`;
  $('#delete-help').hidden = !pages.length;
  $('#pages').replaceChildren();
  if (!pages.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    const title = document.createElement('strong'); title.textContent = '还没有标记过的页面';
    const help = document.createElement('p'); help.textContent = '打开文章，选中文字高亮或加粗后会自动保存。';
    empty.append(title, help);
    $('#pages').append(empty);
  }
  for (const page of pages) {
    const row = document.createElement('article'); row.className = 'page';
    const link = document.createElement('a'); link.href = page.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = page.title;
    link.title = page.title;
    const url = document.createElement('p'); url.className = 'url'; url.textContent = page.url;
    url.title = page.url;
    const meta = document.createElement('p'); meta.className = 'meta';
    const date = new Date(page.updatedAt);
    meta.textContent = Number.isNaN(date.getTime()) ? '已保存在本机' : '最近编辑：' + date.toLocaleString();
    const remove = document.createElement('button'); remove.className = 'delete-page'; remove.textContent = '删除'; remove.disabled = deleting;
    remove.setAttribute('aria-label', '删除页面数据：' + page.title);
    remove.title = '删除该页全部编辑数据，无法撤销';
    remove.onclick = () => run(async () => {
      if (deleting) return;
      deleting = true;
      try {
        await load();
        // Re-read so marks added since opening the popup are included in this page operation.
        const current = C.groupPages(await chrome.storage.local.get(null)).find(p => p.url === page.url);
        if (current) await chrome.storage.local.remove(current.keys);
        status('已删除该页面的全部编辑数据。', 'success');
      } finally { deleting = false; await load(); }
    });
    const bottom = document.createElement('div'); bottom.className = 'page-bottom'; bottom.append(meta, remove);
    row.append(link, url, bottom); $('#pages').append(row);
  }
  await loadActivation(records);
}
chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') run(load); });
run(load);
