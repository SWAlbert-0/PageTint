const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../activation.js');
const emptyPage = { querySelectorAll: () => [], querySelector: () => null, body: null };
test('网站规则按完整域名隔离，HTTP/HTTPS 共用且不影响子域', () => {
  assert.equal(A.hostname('https://blog.example.com/a'), 'blog.example.com');
  assert.equal(A.hostname('http://blog.example.com/b'), 'blog.example.com');
  const data = { [A.RULES]: { 'blog.example.com': 'on' } };
  assert.equal(A.modeFor(data, 'blog.example.com'), 'on');
  assert.equal(A.modeFor(data, 'other.blog.example.com'), 'auto');
});
test('总开关优先于网站允许规则，停用不修改原数据', () => {
  const data = { [A.ENABLED]: false, [A.RULES]: { 'example.com': 'on' }, other: 'keep' };
  const copy = structuredClone(data);
  assert.equal(A.resolve(emptyPage, 'https://example.com/', data).enabled, false);
  assert.deepEqual(data, copy);
});
test('手动允许与停用覆盖识别，旧设置缺省为智能识别', () => {
  assert.equal(A.resolve(emptyPage, 'https://example.com/', { [A.RULES]: { 'example.com': 'on' } }).enabled, true);
  assert.equal(A.resolve(emptyPage, 'https://example.com/', { [A.RULES]: { 'example.com': 'off' } }).enabled, false);
  assert.equal(A.resolve(emptyPage, 'https://example.com/').mode, 'auto');
});
test('内部页面不启用，损坏或继承的网站规则不生效', () => {
  assert.equal(A.resolve(emptyPage, 'chrome://extensions/').enabled, false);
  assert.equal(A.hostname('javascript:alert(1)'), null);
  assert.equal(A.modeFor({ [A.RULES]: { 'example.com': 'invalid' } }, 'example.com'), 'auto');
  assert.equal(A.modeFor({ [A.RULES]: Object.create({ 'example.com': 'on' }) }, 'example.com'), 'auto');
});
test('本机地址按规范化主机判断，所有端口和回环写法均停用', () => {
  const urls = ['http://127.0.0.1:56001/', 'https://127.2.3.4:8443/article', 'http://localhost:5173/', 'http://app.localhost:8080/', 'http://LOCALHOST.:9000/', 'http://[::1]:56001/', 'http://[0:0:0:0:0:0:0:1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://0x7f000001/', 'http://127.1/', 'http://0.0.0.0:3000/', 'http://[::]:3000/'];
  for (const url of urls) {
    assert.equal(A.isLocalHost(A.hostname(url)), true, url);
    assert.equal(A.resolve(emptyPage, url).enabled, false, url);
  }
});
test('本机停用优先于手动启用，且无需识别页面正文', () => {
  const neverRead = { querySelector() { throw Error('must not read local page'); } };
  const state = A.resolve(neverRead, 'http://127.0.0.1:56001/', { [A.RULES]: { '127.0.0.1': 'on' } });
  assert.equal(state.enabled, false);
  assert.equal(state.blocked, true);
});
test('不会把包含本机字样的公网域名误判为本机', () => {
  for (const host of ['localhost.example.com', '127.0.0.1.example.com', 'blog.example.com', '192.168.1.100']) {
    assert.equal(A.isLocalHost(A.hostname('https://' + host)), false, host);
    assert.equal(A.resolve(emptyPage, 'https://' + host, { [A.RULES]: { [host]: 'on' } }).enabled, true, host);
  }
});
