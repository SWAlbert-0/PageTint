const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

function memoryStorage() {
  const data = {};
  return {
    data,
    async get(key) { return { [key]: structuredClone(data[key]) }; },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(key) { delete data[key]; }
  };
}

test('快捷键仅识别 Ctrl+B/Q/Z，忽略输入法、长按与其他组合', () => {
  for (const [key, action] of [['b', 'bold'], ['Q', 'highlight'], ['z', 'undo']])
    assert.equal(C.shortcut({ key, ctrlKey: true }), action);
  for (const event of [{ key: 'b' }, { key: 'z', ctrlKey: true, shiftKey: true },
    { key: 'b', ctrlKey: true, altKey: true }, { key: 'q', ctrlKey: true, metaKey: true },
    { key: 'z', ctrlKey: true, isComposing: true }, { key: 'b', ctrlKey: true, repeat: true }])
    assert.equal(C.shortcut(event), null);
});

test('自定义快捷键按操作匹配，支持 Ctrl、Alt 与 Shift 组合', () => {
  const shortcuts = { bold: 'Ctrl+Shift+K', highlight: 'Alt+H', undo: 'Ctrl+Alt+Z' };
  assert.equal(C.shortcut({ key: 'k', ctrlKey: true, shiftKey: true }, shortcuts), 'bold');
  assert.equal(C.shortcut({ key: 'h', altKey: true }, shortcuts), 'highlight');
  assert.equal(C.shortcut({ key: 'z', ctrlKey: true, altKey: true }, shortcuts), 'undo');
  assert.equal(C.shortcut({ key: 'c', altKey: true }, shortcuts), 'fontColor');
  assert.equal(C.shortcut({ key: 'k', ctrlKey: true }, shortcuts), null);
  assert.equal(C.shortcut({ key: 'b', ctrlKey: true }, shortcuts), null);
  assert.equal(C.shortcutFromEvent({ key: 'k', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+K');
  assert.equal(C.shortcutFromEvent({ key: 'k', shiftKey: true }), null);
  assert.equal(C.shortcutFromEvent({ key: 'Shift', shiftKey: true }), null);
});
test('高亮、加粗与下划线二次操作切换状态并保留其他批注样式', () => {
  const mark = { color: 'yellow', bold: true, underline: false, fontColor: 'red', note: '保留批注' };
  assert.deepEqual(C.toggleStyle(mark, 'highlight', 'blue'), { color: 'none' });
  assert.deepEqual(C.toggleStyle({ ...mark, color: 'none' }, 'highlight', 'blue'), { color: 'blue' });
  assert.deepEqual(C.toggleStyle(mark, 'bold'), { bold: false });
  assert.deepEqual(C.toggleStyle(mark, 'underline'), { underline: true });
  assert.deepEqual(C.toggleStyle(undefined, 'bold'), { bold: true });
  assert.deepEqual(C.toggleStyle(undefined, 'underline'), { underline: true });
  assert.throws(() => C.toggleStyle(mark, 'fontColor'), /不支持/);
});
test('阅读设置规范化损坏数据，保留默认值并限制悬停时间', () => {
  assert.deepEqual(C.normalizePreferences(), { commentHoverDelay: 2000, shortcuts: C.DEFAULT_SHORTCUTS });
  assert.deepEqual(C.normalizePreferences({ commentHoverDelay: 500, shortcuts: { bold: 'Alt+B' } }), {
    commentHoverDelay: 500, shortcuts: { bold: 'Alt+B', highlight: 'Ctrl+Q', fontColor: 'Alt+C', undo: 'Ctrl+Z' }
  });
  assert.equal(C.normalizePreferences({ commentHoverDelay: -1 }).commentHoverDelay, 2000);
  assert.equal(C.normalizePreferences({ commentHoverDelay: 99999 }).commentHoverDelay, 2000);
  assert.equal(C.normalizePreferences({ commentHoverDelay: 0 }).commentHoverDelay, 0);
  assert.equal(C.formatShortcut('Shift+B'), '');
  assert.equal(C.formatShortcut('ctrl+b'), '');
});

test('八种颜色的批注可验证并备份，兼容原有颜色', () => {
  const note = { id: 'abc', url: 'https://a.test/', title: '', note: '', bold: false,
    createdAt: '', updatedAt: '', anchor: { exact: '文字', start: 0, prefix: '', suffix: '' } };
  assert.equal(Object.keys(C.COLORS).length, 8);
  for (const color of [...Object.keys(C.COLORS), 'none']) assert.ok(C.validNote({ ...note, color }));
  assert.ok(!C.validNote({ ...note, color: 'unknown' }));
});

test('新增、编辑、删除按逆序逐步撤销并恢复存储', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  await history.change('a', { note: '原批注' });
  await history.change('a', { note: '修改后' });
  await history.change('a', undefined);
  assert.equal(storage.data.a, undefined);
  assert.equal(await history.undo(), true);
  assert.deepEqual(storage.data.a, { note: '修改后' });
  await history.undo();
  assert.deepEqual(storage.data.a, { note: '原批注' });
  await history.undo();
  assert.equal(storage.data.a, undefined);
  assert.equal(await history.undo(), false);
});

test('快速连续写入和撤销也按顺序执行', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  await Promise.all([history.change('a', '高亮'), history.change('b', '加粗'), history.undo(), history.undo()]);
  assert.deepEqual(storage.data, {});
});

test('存储失败不产生撤销记录，撤销失败可重试', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  const set = storage.set;
  storage.set = async () => { throw new Error('quota'); };
  await assert.rejects(history.change('a', '失败'), /quota/);
  storage.set = set;
  assert.equal(await history.undo(), false);
  await history.change('a', '成功');
  const remove = storage.remove;
  storage.remove = async () => { throw new Error('storage error'); };
  await assert.rejects(history.undo(), /storage error/);
  storage.remove = remove;
  assert.equal(await history.undo(), true);
  assert.deepEqual(storage.data, {});
});

test('其他标签页更改后撤销不会覆盖新数据', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  await history.change('a', '本页笔记');
  await storage.set({ a: '其他窗口新编辑' });
  await assert.rejects(history.undo(), /其他窗口/);
  assert.equal(storage.data.a, '其他窗口新编辑');
});

test('存储改变对象属性顺序不会误判为其他窗口修改', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  await history.change('a', { color: 'pink', anchor: { start: 0, exact: '选文' } });
  storage.data.a = { anchor: { exact: '选文', start: 0 }, color: 'pink' };
  assert.equal(await history.undo(), true);
  assert.deepEqual(storage.data, {});
});

test('不同页面保留独立撤销栈，最多保存指定步数', async () => {
  const storage = memoryStorage(), first = C.createHistory(storage, 2), second = C.createHistory(storage);
  await first.change('a', 1); await first.change('b', 2); await first.change('c', 3);
  await second.change('d', 4);
  await first.undo(); await first.undo();
  assert.equal(await first.undo(), false);
  assert.deepEqual(storage.data, { a: 1, d: 4 });
  await second.undo();
  assert.deepEqual(storage.data, { a: 1 });
});
test('换高亮色和文字色均可撤销，始终只保留同一条记录', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  const original = { id: 'a', url: 'https://a.test/', title: '', note: '', color: 'yellow', bold: false, createdAt: '', updatedAt: '', anchor: { exact: '原文', start: 0, prefix: '', suffix: '' } };
  await history.change('course-note:a', original);
  await history.change('course-note:a', C.updateMark(original, { color: 'green' }));
  await history.change('course-note:a', C.updateMark(storage.data['course-note:a'], { fontColor: 'red' }));
  assert.equal(Object.keys(storage.data).length, 1);
  await history.undo();
  assert.equal(storage.data['course-note:a'].fontColor, undefined);
  assert.equal(storage.data['course-note:a'].color, 'green');
  await history.undo();
  assert.deepEqual(storage.data['course-note:a'], original);
});
test('下划线兼容旧记录、保存后可恢复，并可撤销且保留其他样式', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  const original = { id: 'a', url: 'https://a.test/', title: '', note: '', color: 'yellow', bold: true, fontColor: 'blue', createdAt: '', updatedAt: '', anchor: { exact: '原文', start: 0, prefix: '', suffix: '' } };
  assert.ok(C.validNote(original));
  await storage.set({ 'course-note:a': original });
  await history.change('course-note:a', C.updateMark(original, { underline: true }));
  const saved = (await storage.get('course-note:a'))['course-note:a'];
  assert.ok(C.validNote(saved));
  assert.equal(saved.underline, true);
  assert.equal(saved.color, 'yellow');
  assert.equal(saved.bold, true);
  assert.equal(saved.fontColor, 'blue');
  assert.ok(!C.validNote({ ...saved, underline: 'true' }));
  await history.undo();
  assert.deepEqual(storage.data['course-note:a'], original);
});
test('自定义高亮和文字颜色可保存与撤销，其他样式不丢失', async () => {
  const storage = memoryStorage(), history = C.createHistory(storage);
  const original = { id: 'a', url: 'https://a.test/', title: '', note: '', color: 'yellow', bold: true, underline: true, createdAt: '', updatedAt: '', anchor: { exact: '原文', start: 0, prefix: '', suffix: '' } };
  await storage.set({ 'course-note:a': original });
  await history.change('course-note:a', C.updateMark(original, { color: '#bada55', fontColor: '#123456' }));
  const saved = (await storage.get('course-note:a'))['course-note:a'];
  assert.ok(C.validNote(saved));
  assert.equal(saved.color, '#bada55');
  assert.equal(saved.fontColor, '#123456');
  assert.equal(saved.underline, true);
  assert.equal(saved.bold, true);
  await history.undo();
  assert.deepEqual(storage.data['course-note:a'], original);
});
