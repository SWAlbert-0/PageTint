const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const text = 'abcdefghij';
const anchor = (start, end) => ({ exact: text.slice(start, end), start, prefix: text.slice(0, start), suffix: text.slice(end) });
const mark = (id, start, end, extra = {}) => ({ id, url: 'https://a.test/', title: '课程', note: '', color: 'yellow', bold: true, underline: true, fontColor: 'blue', createdAt: '1', updatedAt: '1', anchor: anchor(start, end), ...extra });
function storageFor(marks) {
  const data = Object.fromEntries(marks.map(m => [C.PREFIX + m.id, structuredClone(m)]));
  return { data, async get(key) { return { [key]: structuredClone(data[key]) }; }, async set(values) { Object.assign(data, structuredClone(values)); }, async remove(key) { delete data[key]; } };
}
test('部分复原切开所有重叠标记，只保留选区之外的原样式', () => {
  const marks = [mark('a', 0, 10), mark('b', 2, 8, { color: 'none' }), mark('c', 8, 10)];
  let id = 0;
  const changes = C.restoreChanges(marks, text, anchor(3, 6), () => 'split-' + ++id);
  assert.equal(changes.length, 4);
  assert.deepEqual(changes.map(c => c.after.anchor.exact), ['abc', 'ghij', 'c', 'gh']);
  assert.ok(changes.every(c => C.validNote(c.after)));
  assert.ok(changes.every(c => c.after.bold && c.after.underline && c.after.fontColor === 'blue'));
  assert.ok(changes.every(c => !c.after.anchor.exact.includes('def')));
  assert.equal(changes.find(c => c.after.id === 'a').after.updatedAt, marks[0].updatedAt);
  assert.ok(changes.every(c => c.key !== C.PREFIX + 'c'));
});
test('整段复原清除所有重叠样式，无关和无法定位的标记不变', () => {
  const marks = [mark('a', 0, 3), mark('b', 0, 3), mark('c', 8, 10), { ...mark('missing', 0, 3), anchor: { ...anchor(0, 3), exact: '不存在' } }];
  const changes = C.restoreChanges(marks, text, anchor(0, 3));
  assert.deepEqual(changes.map(c => c.key), ['course-note:a', 'course-note:b']);
  assert.ok(changes.every(c => c.after === undefined));
  assert.deepEqual(C.restoreChanges(marks, text, anchor(4, 6)), []);
});
test('复原多个重叠标记后，单次撤销完整恢复', async () => {
  const marks = [mark('a', 0, 10), mark('b', 2, 8)];
  const storage = storageFor(marks), history = C.createHistory(storage), original = structuredClone(storage.data);
  let id = 0;
  await history.changeMany(C.restoreChanges(marks, text, anchor(3, 6), () => 'split-' + ++id));
  assert.equal(Object.keys(storage.data).length, 4);
  assert.equal(await history.undo(), true);
  assert.deepEqual(storage.data, original);
  assert.equal(await history.undo(), false);
});
test('复原写入失败时回滚已写记录，不产生撤销记录', async () => {
  const marks = [mark('a', 0, 10)], storage = storageFor(marks), history = C.createHistory(storage);
  const original = structuredClone(storage.data), set = storage.set;
  let failed = false;
  storage.set = async values => {
    if (!failed && values['course-note:split']) { failed = true; throw new Error('quota'); }
    return set(values);
  };
  await assert.rejects(history.changeMany(C.restoreChanges(marks, text, anchor(3, 6), () => 'split')), /quota/);
  assert.deepEqual(storage.data, original);
  assert.equal(await history.undo(), false);
});
test('其他标签已删除原标记时复原不会重新创建它', async () => {
  const marks = [mark('a', 0, 10)], storage = storageFor(marks), history = C.createHistory(storage);
  await storage.remove('course-note:a');
  await assert.rejects(history.changeMany(C.restoreChanges(marks, text, anchor(3, 6))), /其他窗口/);
  assert.deepEqual(storage.data, {});
});
