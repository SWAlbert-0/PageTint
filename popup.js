'use strict';
const C = globalThis.PageTint;
const $ = selector => document.querySelector(selector);
let deleting = false;
function status(message) { $('#status').textContent = message; }
async function run(fn) { try { await fn(); } catch (error) { status('操作失败：' + error.message); } }
$('#export-markdown').onclick = () => run(async () => {
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
    status('已发起下载，将 .md 文件放入 Obsidian 仓库即可。' + (result.warnings.length ? '\n注意：' + result.warnings.join('；') : ''));
  } finally { button.disabled = false; }
});
async function load() {
  const pages = C.groupPages(await chrome.storage.local.get(null));
  $('#summary').textContent = `已保存 ${pages.length} 个页面`;
  $('#pages').replaceChildren();
  if (!pages.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = '暂无页面数据。选中网页文字，高亮或加粗后会自动保存。';
    $('#pages').append(empty);
  }
  for (const page of pages) {
    const row = document.createElement('article'); row.className = 'page';
    const link = document.createElement('a'); link.href = page.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = page.title;
    const url = document.createElement('p'); url.className = 'url'; url.textContent = page.url;
    const meta = document.createElement('p'); meta.className = 'meta';
    const date = new Date(page.updatedAt);
    meta.textContent = Number.isNaN(date.getTime()) ? '已保存在本机' : '最近编辑：' + date.toLocaleString();
    const remove = document.createElement('button'); remove.textContent = '删除页面数据'; remove.disabled = deleting;
    remove.onclick = () => run(async () => {
      if (deleting) return;
      deleting = true;
      try {
        await load();
        // Re-read so marks added since opening the popup are included in this page operation.
        const current = C.groupPages(await chrome.storage.local.get(null)).find(p => p.url === page.url);
        if (current) await chrome.storage.local.remove(current.keys);
        status('已删除该页面的全部编辑数据。');
      } finally { deleting = false; await load(); }
    });
    row.append(link, url, meta, remove); $('#pages').append(row);
  }
}
chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') run(load); });
run(load);
