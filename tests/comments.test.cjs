const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
global.katex = require('../vendor/katex.min.js');
const Comments = require('../comments.js');

test('批注解析四种 TeX 定界符并保留普通文字', () => {
  const source = '行内 $E=mc^2$ 和 \\(a+b\\)\n$$\\int_0^1 x\\,dx$$\n\\[\\frac{a}{b}\\]';
  const tokens = Comments.parse(source);
  assert.deepEqual(tokens.filter(token => token.type === 'math').map(token => [token.tex, token.display]), [
    ['E=mc^2', false], ['a+b', false], ['\\int_0^1 x\\,dx', true], ['\\frac{a}{b}', true]
  ]);
  assert.equal(tokens[0].value, '行内 ');
  assert.equal(Comments.parse('价格 $5 and $10')[0].type, 'text');
  assert.equal(Comments.parse('未完成 $x^2')[0].value, '未完成 $x^2');
  assert.equal(Comments.parse('美元 \\$100')[0].value, '美元 $100');
});

test('Markdown 只转义普通文字，公式源码保持不变', () => {
  const output = Comments.toMarkdown('**普通** <文字> $x < y$', value => value.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  assert.equal(output, '**普通** &lt;文字&gt; $x < y$');
});

test('TeX 在本地渲染为行内和块级 MathML', () => {
  const dom = new JSDOM('<div id="preview"></div>');
  try {
    const container = dom.window.document.getElementById('preview');
    const errors = Comments.render(container, '能量 $E=mc^2$\n$$\\frac{a}{b}$$');
    assert.deepEqual(errors, []);
    const math = container.querySelectorAll('math');
    assert.equal(math.length, 2);
    assert.equal(math[0].getAttribute('display'), null);
    assert.equal(math[1].getAttribute('display'), 'block');
    assert.deepEqual([...container.querySelectorAll('annotation')].map(node => node.textContent), ['E=mc^2', '\\frac{a}{b}']);
    assert.ok(container.textContent.includes('能量'));
  } finally { dom.window.close(); }
});

test('批注 HTML 作为纯文本处理，不信任公式中的链接或 HTML', () => {
  const dom = new JSDOM('<div id="preview"></div>');
  try {
    const container = dom.window.document.getElementById('preview');
    Comments.render(container, '<img src=x onerror=alert(1)> $\\href{javascript:alert(1)}{\\text{危险}}$');
    assert.equal(container.querySelector('img,a,script'), null);
    assert.ok(container.textContent.includes('<img src=x onerror=alert(1)>'));
    assert.equal(container.querySelectorAll('math').length, 1);
    assert.equal(container.querySelectorAll('.comment-math-error').length, 0);
  } finally { dom.window.close(); }
});

test('公式语法错误显示原始 TeX 并返回保存前提示', () => {
  const dom = new JSDOM('<div id="preview"></div>');
  try {
    const container = dom.window.document.getElementById('preview');
    const errors = Comments.render(container, '$\\frac{1}{$');
    assert.equal(errors.length, 1);
    assert.equal(container.querySelector('.comment-math-error').textContent, '$\\frac{1}{$');
    assert.equal(container.querySelector('math'), null);
  } finally { dom.window.close(); }
});
