const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../core.js');
const M = require('../migration.js');
const mark = { id: 'a', url: 'https://example.com/article/#section', title: '课程', note: '', color: '#aabbcc', fontColor: 'red', bold: true, underline: true, createdAt: '2026', updatedAt: '2026', anchor: { exact: '正文', start: 0, prefix: '', suffix: '' } };
const source = { 'course-note:a': mark, highlightColor: '#aabbcc', recentHighlightColors: ['#aabbcc'], recentTextColors: ['#c62828'], customSetting: { nested: ['完整保留', 1, false] } };
function memory(data = {}) {
  return { data: structuredClone(data), async get(keys) {
    return keys === null ? structuredClone(this.data) : Object.fromEntries(keys.filter(key => Object.hasOwn(this.data, key)).map(key => [key, structuredClone(this.data[key])]));
  }, async set(values) { Object.assign(this.data, structuredClone(values)); } };
}
test('跨扩展迁移保留所有标记样式、定位和颜色偏好，并写入校验回执', async () => {
  const file = await M.backup(source, 'old'), storage = memory();
  assert.deepEqual(file.summary, { pages: 1, marks: 1, keys: 5 });
  const receipt = await M.importBackup(storage, file, 'new');
  for (const key of Object.keys(source)) assert.deepEqual(storage.data[key], source[key]);
  assert.equal(receipt.sha256, file.sha256);
  assert.equal(receipt.sourceId, 'old');
  assert.equal(receipt.destinationId, 'new');
  assert.deepEqual(storage.data[M.RECEIPT], receipt);
  assert.deepEqual(source['course-note:a'], mark);
});
test('重复导入去重，保留目标其他页面和设置', async () => {
  const storage = memory({ extra: '保留' }), file = await M.backup(source, 'old');
  await M.importBackup(storage, file, 'new');
  await M.importBackup(storage, file, 'new');
  assert.equal(storage.data.extra, '保留');
  assert.equal(Object.keys(storage.data).filter(key => key.startsWith('course-note:')).length, 1);
});
test('同一来源 ID 或目标存在冲突时停止，原数据不变', async () => {
  const file = await M.backup(source, 'old'), storage = memory({ highlightColor: 'blue' });
  await assert.rejects(M.importBackup(storage, file, 'old'), /原扩展/);
  await assert.rejects(M.importBackup(storage, file, 'new'), /已有不同数据/);
  assert.deepEqual(storage.data, { highlightColor: 'blue' });
});
test('文件损坏、统计错误和错误文件类型在写入前被拒绝', async () => {
  const storage = memory(), file = await M.backup(source, 'old');
  const modified = structuredClone(file); modified.records.highlightColor = 'pink';
  await assert.rejects(M.importBackup(storage, modified, 'new'), /校验失败/);
  await assert.rejects(M.importBackup(storage, { ...file, summary: { ...file.summary, marks: 2 } }, 'new'), /统计不一致/);
  await assert.rejects(M.importBackup(storage, { format: 'markdown' }, 'new'), /迁移工具/);
  assert.deepEqual(storage.data, {});
});
test('读回校验失败不报告成功，保留备份用于重试', async () => {
  const storage = memory(), file = await M.backup(source, 'old'), get = storage.get;
  storage.get = async function (keys) { const result = await get.call(this, keys); if (Array.isArray(keys)) delete result.highlightColor; return result; };
  await assert.rejects(M.importBackup(storage, file, 'new'), /写入后校验失败/);
  assert.equal(storage.data[M.RECEIPT], undefined);
  assert.equal(await M.digest(file.records), file.sha256);
});
test('备份校验不依赖对象属性顺序，不包含旧迁移回执', async () => {
  assert.equal(await M.digest({ a: { x: 1, y: 2 }, b: 3 }), await M.digest({ b: 3, a: { y: 2, x: 1 } }));
  const file = await M.backup({ ...source, [M.RECEIPT]: { old: true } }, 'old');
  assert.equal(file.records[M.RECEIPT], undefined);
});
