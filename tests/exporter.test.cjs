const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../core.js');
const E = require('../exporter.js');
test('导出文件名避开 Windows 非法字符和设备名', () => {
  assert.equal(E.filename('标题 / 第一章?'), '标题 - 第一章-.md');
  assert.equal(E.filename('CON'), '_CON.md');
  assert.equal(E.filename(' . '), '网页正文.md');
  assert.ok(E.filename('字'.repeat(200)).length <= 103);
});
test('导出链接转为绝对地址，丢弃可执行协议', () => {
  assert.equal(E.safeURL('../image.png', 'https://a.test/book/chapter/'), 'https://a.test/book/image.png');
  assert.equal(E.safeURL('#section', 'https://a.test/book/'), 'https://a.test/book/#section');
  assert.equal(E.safeURL('javascript:alert(1)', 'https://a.test/'), null);
  assert.equal(E.safeURL('data:text/html,test', 'https://a.test/'), null);
});
