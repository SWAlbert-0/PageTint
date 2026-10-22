const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
test('课程地址保留查询参数与 hash 路由', () => {
  assert.notEqual(C.pageKey('https://a.test/?lesson=1'), C.pageKey('https://a.test/?lesson=2'));
  assert.notEqual(C.pageKey('https://a.test/#/1'), C.pageKey('https://a.test/#/2'));
});
test('同一篇课程不同小节合并，旧记录一起管理和删除', () => {
  const a = 'https://bojieli.github.io/ai-agent-book/book/chapter3/#%E8%AE%B0%E5%BF%86%E7%9A%84%E5%B1%82%E6%AC%A1%E7%BB%93%E6%9E%84';
  const b = 'https://bojieli.github.io/ai-agent-book/book/chapter3/#%E8%AE%B0%E5%BF%86%E8%83%BD%E5%8A%9B%E7%9A%84%E8%AF%84%E4%BC%B0%E4%B8%89%E5%B1%82%E6%AC%A1%E6%A1%86%E6%9E%B6';
  const canonical = 'https://bojieli.github.io/ai-agent-book/book/chapter3/';
  assert.equal(C.pageKey(a), canonical);
  assert.equal(C.pageKey(b), canonical);
  const base = { title: '第三章', note: '', color: 'yellow', bold: false, createdAt: '', updatedAt: '', anchor: { exact: '原文', start: 0, prefix: '', suffix: '' } };
  const records = { 'course-note:a': { ...base, id: 'a', url: a }, 'course-note:b': { ...base, id: 'b', url: b } };
  const pages = C.groupPages(records);
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].keys, ['course-note:a', 'course-note:b']);
  for (const key of pages[0].keys) delete records[key];
  assert.deepEqual(records, {});
});
test('追踪参数与查询顺序不产生重复页面，章节参数仍区分', () => {
  assert.equal(C.pageKey('https://a.test/?b=2&utm_source=test&a=1#heading'), 'https://a.test/?a=1&b=2');
  assert.equal(C.pageKey('https://a.test/?a=1&b=2&gclid=x'), 'https://a.test/?a=1&b=2');
  assert.notEqual(C.pageKey('https://a.test/#/chapter1'), C.pageKey('https://a.test/#/chapter2'));
  assert.notEqual(C.pageKey('https://a.test/#lesson=1'), C.pageKey('https://a.test/#lesson=2'));
});
test('修改已有标记的高亮与文字颜色保留 ID、锚点及加粗，兼容旧数据', () => {
  const mark = { id: 'a', url: 'https://a.test/', title: '课程', note: '', color: 'yellow', bold: true, createdAt: '2026-10-22', updatedAt: '2026-10-22', anchor: { exact: '原文', start: 0, prefix: '', suffix: '' } };
  const updated = C.updateMark(mark, { color: 'pink', fontColor: 'blue' }, '2026-10-23');
  assert.equal(updated.id, mark.id);
  assert.deepEqual(updated.anchor, mark.anchor);
  assert.equal(updated.bold, true);
  assert.equal(updated.color, 'pink');
  assert.equal(updated.fontColor, 'blue');
  assert.equal(updated.updatedAt, '2026-10-23');
  assert.equal(mark.color, 'yellow');
  assert.ok(C.validNote(mark));
  assert.ok(!C.validNote({ ...updated, fontColor: 'invalid' }));
  assert.throws(() => C.updateMark(mark, { color: 'invalid' }));
});
test('插入新段落后用前后文定位重复句子', () => {
  assert.deepEqual(C.locate('前言 A相同B C相同D', { exact: '相同', prefix: 'C', suffix: 'D', start: 1 }), { start: 9, end: 11 });
});
test('上下文不明确时不把重复句子匹配到另一处', () => {
  assert.equal(C.locate('同句 同句', { exact: '同句', prefix: '缺失', suffix: '', start: 0 }), null);
});
test('原文唯一时即使前后文修改仍可恢复', () => {
  assert.deepEqual(C.locate('新前文唯一新后文', { exact: '唯一', prefix: '旧', suffix: '旧', start: 0 }), { start: 3, end: 5 });
});
test('原文已删除时保留未定位状态', () => assert.equal(C.locate('新内容', { exact: '旧内容' }), null));
test('备份验证拒绝脚本 URL 与无效数据', () => {
  const note = { id: 'abc-123', url: 'https://a.test/', title: '课程', note: '理解', color: 'yellow', bold: false, createdAt: '2026-10-22', updatedAt: '2026-10-22', anchor: { exact: '正文', start: 0, prefix: '', suffix: '' } };
  assert.ok(C.validNote(note));
  assert.ok(!C.validNote({ ...note, url: 'javascript:alert(1)' }));
  assert.ok(!C.validNote({ ...note, url: 'https://' }));
  assert.ok(!C.validNote({ ...note, anchor: { ...note.anchor, start: -1 } }));
});
test('数据管理按完整页面地址聚合，删除键只属于对应页面', () => {
  const base = { title: '课程', note: '', color: 'yellow', bold: false, createdAt: '2026-10-22', anchor: { exact: '正文', start: 0, prefix: '', suffix: '' } };
  const records = {
    'course-note:a': { ...base, id: 'a', url: 'https://a.test/?lesson=1', updatedAt: '2026-10-22T10:00:00Z' },
    'course-note:b': { ...base, id: 'b', title: '课程新标题', url: 'https://a.test/?lesson=1', updatedAt: '2026-10-22T12:00:00Z' },
    'course-note:c': { ...base, id: 'c', url: 'https://a.test/?lesson=2', updatedAt: '2026-10-22T11:00:00Z' },
    'course-note:d': { ...base, id: 'd', url: 'https://a.test/?lesson=1#/chapter', updatedAt: '2026-10-22T09:00:00Z' },
    'course-note:bad': { id: 'bad' }, highlightColor: 'pink'
  };
  const pages = C.groupPages(records);
  assert.equal(pages.length, 3);
  assert.equal(pages[0].title, '课程新标题');
  assert.deepEqual(pages[0].keys, ['course-note:a', 'course-note:b']);
  for (const key of pages[0].keys) delete records[key];
  assert.equal(C.groupPages(records).length, 2);
  assert.ok(records['course-note:c']);
  assert.ok(records['course-note:d']);
  assert.equal(records.highlightColor, 'pink');
  assert.deepEqual(C.groupPages({}), []);
});
test('扩展色板、自定义 HEX 与高亮透明度兼容旧颜色', () => {
  assert.equal(C.EXTRA_HIGHLIGHTS.length, 24);
  assert.equal(C.EXTRA_TEXT_COLORS.length, 24);
  assert.equal(C.normalizeHex(' #AbC '), '#aabbcc');
  assert.equal(C.normalizeHex('#12abEF'), '#12abef');
  for (const invalid of ['red', '#12345', '#12345678', 'url(test)', null]) assert.equal(C.normalizeHex(invalid), null);
  assert.equal(C.colorValue('highlight', '#123456'), '#12345699');
  assert.equal(C.colorValue('text', '#123456'), '#123456');
  assert.equal(C.colorValue('highlight', 'yellow'), C.COLORS.yellow.value);
  assert.equal(C.colorValue('text', 'gray'), C.TEXT_COLORS.gray.value);
  for (const color of [...C.EXTRA_HIGHLIGHTS, ...C.EXTRA_TEXT_COLORS]) assert.ok(C.normalizeHex(color));
});
test('最近颜色归一化、去重、置顶、限六个并过滤损坏记录', () => {
  assert.deepEqual(C.recentColors(['#aabbcc', '#123456', '#ABC', 'bad'], '#123456'), ['#123456', '#aabbcc']);
  assert.deepEqual(C.recentColors(null, '#abc'), ['#aabbcc']);
  assert.deepEqual(C.recentColors(['#112233'], null), ['#112233']);
  const colors = ['#111111','#222222','#333333','#444444','#555555','#666666'];
  assert.deepEqual(C.recentColors(colors, '#777777'), ['#777777', ...colors.slice(0, 5)]);
});
