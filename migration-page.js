'use strict';
const M = globalThis.PageTintMigration;
const $ = selector => document.querySelector(selector);
function status(message) { $('#status').textContent = message; }
async function run(fn) {
  $('#backup').disabled = $('#import').disabled = true;
  try { await fn(); } catch (error) { status('操作失败：' + error.message); }
  finally { $('#backup').disabled = $('#import').disabled = false; }
}
async function load() {
  const records = await chrome.storage.local.get(null), counts = M.summary(records);
  $('#identity').textContent = `名称：${chrome.runtime.getManifest().name} · 版本：${chrome.runtime.getManifest().version}\n扩展 ID：${chrome.runtime.id}`;
  $('#summary').textContent = `当前保存 ${counts.pages} 个页面、${counts.marks} 条标记。`;
  const receipt = records[M.RECEIPT];
  if (receipt?.destinationId === chrome.runtime.id) $('#receipt').textContent = `最近一次迁移校验通过\n来源 ID：${receipt.sourceId}\n目标 ID：${receipt.destinationId}\n${receipt.pages} 个页面、${receipt.marks} 条标记 · 校验时间：${receipt.verifiedAt}`;
}
$('#backup').onclick = () => run(async () => {
  const file = await M.backup(await chrome.storage.local.get(null), chrome.runtime.id);
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'pagetint-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(`已发起备份下载：${file.summary.pages} 个页面、${file.summary.marks} 条标记。请确认文件已下载，再停用原扩展。`);
});
$('#import').onclick = () => $('#file').click();
$('#file').onchange = () => run(async () => {
  const file = $('#file').files[0]; $('#file').value = ''; if (!file) return;
  if (file.size > 25 * 1024 * 1024) throw new Error('文件超过 25 MB，未导入');
  status('正在导入并校验…');
  const receipt = await M.importBackup(chrome.storage.local, JSON.parse(await file.text()), chrome.runtime.id);
  await load();
  status(`迁移校验通过：${receipt.pages} 个页面、${receipt.marks} 条标记，备份内 ${receipt.keys} 项数据全部一致。\n请刷新文章检查标记，确认后再卸载原扩展并清理旧目录链接。`);
});
run(load);
