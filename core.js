(function (root) {
  'use strict';
  const PREFIX = 'course-note:';
  const COLORS = Object.freeze({
    yellow: { label: '黄色', value: '#ffdf6e99' },
    green: { label: '绿色', value: '#8cdda699' },
    blue: { label: '蓝色', value: '#92caff99' },
    pink: { label: '粉色', value: '#ffacd399' },
    orange: { label: '橙色', value: '#ffba7899' },
    purple: { label: '紫色', value: '#c7a2ef99' },
    cyan: { label: '青色', value: '#7cddd899' },
    gray: { label: '灰色', value: '#bec9d499' }
  });
  const TEXT_COLORS = Object.freeze({
    black: { label: '黑色', value: '#202124' }, red: { label: '红色', value: '#c62828' },
    orange: { label: '橙色', value: '#a84b00' }, green: { label: '绿色', value: '#217a36' },
    cyan: { label: '青色', value: '#007b83' }, blue: { label: '蓝色', value: '#245ec7' },
    purple: { label: '紫色', value: '#7e36b2' }, gray: { label: '灰色', value: '#646b73' }
  });
  const EXTRA_HIGHLIGHTS = Object.freeze(['#ffdf6e', '#ffe8a3', '#ffd3a3', '#ffb5a7', '#ffacd3', '#f2c3df', '#deb9ee', '#c7a2ef', '#bcbcff', '#a5ceff', '#92caff', '#b5e2fa', '#7cddd8', '#a3e4d7', '#8cdda6', '#c7e9a0', '#e4efac', '#eee1b9', '#dfc5ac', '#dbd0e5', '#c4dae5', '#bec9d4', '#d9d9d9', '#ededed']);
  const EXTRA_TEXT_COLORS = Object.freeze(['#202124', '#646b73', '#8c949d', '#c62828', '#a6192e', '#b34765', '#a84b00', '#995d00', '#806600', '#217a36', '#19634a', '#38704c', '#007b83', '#006977', '#296981', '#245ec7', '#214694', '#4452ad', '#7e36b2', '#633c8f', '#994080', '#6d4c41', '#815b46', '#526577']);
  function normalizeHex(value) {
    if (typeof value !== 'string') return null;
    const hex = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) return '#' + [...hex.slice(1)].map(c => c + c).join('');
    return null;
  }
  function colorValue(kind, color) {
    const palette = kind === 'highlight' ? COLORS : TEXT_COLORS;
    if (Object.hasOwn(palette, color)) return palette[color].value;
    const hex = normalizeHex(color);
    return hex ? hex + (kind === 'highlight' ? '99' : '') : null;
  }
  function recentColors(previous, color, limit = 6) {
    const entries = [color, ...(Array.isArray(previous) ? previous : [])].map(normalizeHex).filter(Boolean);
    return [...new Set(entries)].slice(0, limit);
  }
  function shortcut(event) {
    if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing || event.repeat) return null;
    return ({ b: 'bold', q: 'highlight', z: 'undo' })[event.key.toLowerCase()] || null;
  }
  // Each extension view keeps its own undo stack. Writes and undos are serialized.
  function createHistory(storage, limit = 100) {
    const stack = [];
    let tail = Promise.resolve(), pending = 0;
    // Extension storage may return object properties in a different order.
    const fingerprint = value => JSON.stringify(value, (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
    const read = async key => (await storage.get(key))[key];
    const write = async (key, value) => value === undefined ? storage.remove(key) : storage.set({ [key]: value });
    function enqueue(fn) {
      pending++;
      const result = tail.then(fn);
      tail = result.catch(() => {}).finally(() => pending--);
      return result;
    }
    async function writeGroup(items, target, source) {
      const applied = [];
      try {
        for (const item of items) { await write(item.key, item[target]); applied.push(item); }
      } catch (error) {
        for (const item of applied.reverse()) await write(item.key, item[source]);
        throw error;
      }
    }
    function changeMany(entries) {
      return enqueue(async () => {
        const items = [];
        for (const entry of entries) {
          const before = await read(entry.key);
          if (Object.hasOwn(entry, 'before') && fingerprint(before) !== fingerprint(entry.before))
            throw new Error('编辑数据已在其他窗口更改，请重新选择后重试');
          if (fingerprint(before) !== fingerprint(entry.after)) items.push({ key: entry.key, before, after: entry.after });
        }
        if (!items.length) return false;
        await writeGroup(items, 'after', 'before');
        stack.push(items);
        if (stack.length > limit) stack.shift();
        return true;
      });
    }
    return {
      canUndo: () => stack.length > 0 || pending > 0,
      change: (key, after) => changeMany([{ key, after }]),
      changeMany,
      undo() {
        return enqueue(async () => {
          const items = stack.at(-1);
          if (!items) return false;
          for (const item of items) {
            if (fingerprint(await read(item.key)) !== fingerprint(item.after))
              throw new Error('编辑数据已在其他窗口更改或删除，无法撤销，以免覆盖新内容');
          }
          await writeGroup(items, 'before', 'after');
          stack.pop();
          return true;
        });
      }
    };
  }
  // Ignore in-page headings and known tracking parameters, but retain lesson IDs and SPA routes.
  function pageKey(url) {
    const page = new URL(url);
    if (!/^#(?:\/|!|.*[=?])/.test(page.hash)) page.hash = '';
    for (const key of [...page.searchParams.keys()])
      if (/^(utm_.+|fbclid|gclid|msclkid|dclid|mc_cid|mc_eid)$/i.test(key)) page.searchParams.delete(key);
    page.searchParams.sort();
    return page.href;
  }
  function updateMark(mark, patch, timestamp = new Date().toISOString()) {
    const updated = { ...mark, ...patch, updatedAt: timestamp };
    if (!validNote(updated)) throw new Error('无效的文字样式');
    return updated;
  }
  function locate(text, anchor) {
    const { exact, prefix = '', suffix = '', start } = anchor;
    if (!exact) return null;
    const contextMatches = i => text.slice(Math.max(0, i - prefix.length), i) === prefix &&
      text.slice(i + exact.length, i + exact.length + suffix.length) === suffix;
    if (Number.isInteger(start) && text.slice(start, start + exact.length) === exact && contextMatches(start))
      return { start, end: start + exact.length };
    const candidates = [];
    for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) candidates.push(i);
    if (candidates.length === 1) return { start: candidates[0], end: candidates[0] + exact.length };
    const matches = candidates.filter(contextMatches);
    return matches.length === 1 ? { start: matches[0], end: matches[0] + exact.length } : null;
  }
  function restoreChanges(marks, text, selection, newId = () => crypto.randomUUID()) {
    const cut = locate(text, selection);
    if (!cut) return [];
    const changes = [];
    for (const mark of marks) {
      const position = locate(text, mark.anchor);
      if (!position || position.end <= cut.start || position.start >= cut.end) continue;
      const segments = [];
      if (position.start < cut.start) segments.push({ start: position.start, end: cut.start });
      if (position.end > cut.end) segments.push({ start: cut.end, end: position.end });
      if (!segments.length) { changes.push({ key: PREFIX + mark.id, before: mark, after: undefined }); continue; }
      segments.forEach(({ start, end }, index) => {
        const id = index === 0 ? mark.id : newId();
        const anchor = { exact: text.slice(start, end), start, prefix: text.slice(Math.max(0, start - 48), start), suffix: text.slice(end, end + 48) };
        // Keep original ordering so restoring part of a mark doesn't change styles elsewhere.
        changes.push({ key: PREFIX + id, before: index === 0 ? mark : undefined, after: { ...mark, id, anchor } });
      });
    }
    return changes;
  }
  function validNote(n) {
    try {
      if (!n || !['http:', 'https:'].includes(new URL(n.url).protocol)) return false;
    } catch { return false; }
    return n && typeof n.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(n.id) &&
      typeof n.url === 'string' && /^https?:\/\//.test(n.url) &&
      typeof n.title === 'string' && typeof n.note === 'string' && n.note.length <= 20000 &&
      (colorValue('highlight', n.color) !== null || n.color === 'none') && typeof n.bold === 'boolean' &&
      (n.fontColor === undefined || colorValue('text', n.fontColor) !== null) &&
      (n.underline === undefined || typeof n.underline === 'boolean') &&
      typeof n.createdAt === 'string' && typeof n.updatedAt === 'string' &&
      n.anchor && typeof n.anchor.exact === 'string' && n.anchor.exact.length > 0 && n.anchor.exact.length <= 20000 &&
      typeof n.anchor.prefix === 'string' && n.anchor.prefix.length <= 64 &&
      typeof n.anchor.suffix === 'string' && n.anchor.suffix.length <= 64 &&
      Number.isInteger(n.anchor.start) && n.anchor.start >= 0;
  }
  function groupPages(records) {
    const pages = new Map();
    for (const [key, mark] of Object.entries(records)) {
      if (!key.startsWith(PREFIX) || !validNote(mark)) continue;
      const url = pageKey(mark.url);
      if (!pages.has(url)) pages.set(url, { url, title: mark.title || url, updatedAt: mark.updatedAt, keys: [] });
      const page = pages.get(url);
      page.keys.push(key);
      if (mark.updatedAt > page.updatedAt) { page.title = mark.title || url; page.updatedAt = mark.updatedAt; }
    }
    return [...pages.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.url.localeCompare(b.url));
  }
  const api = { PREFIX, COLORS, TEXT_COLORS, EXTRA_HIGHLIGHTS, EXTRA_TEXT_COLORS, normalizeHex, colorValue, recentColors, shortcut, createHistory, pageKey, locate, validNote, groupPages, updateMark, restoreChanges };
  root.PageTint = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
