(function (root) {
  'use strict';
  const C = root.PageTint;
  const RECEIPT = 'pagetint-migration-receipt';
  function canonical(value) {
    return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  }
  async function digest(records) {
    const bytes = new TextEncoder().encode(canonical(records));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function validateRecords(records) {
    if (!records || Array.isArray(records) || typeof records !== 'object') throw new Error('备份数据格式无效');
    for (const [key, record] of Object.entries(records)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('备份包含无效键');
      if (key.startsWith(C.PREFIX) && (!C.validNote(record) || key !== C.PREFIX + record.id))
        throw new Error('备份中存在损坏的编辑记录，未导入任何数据');
    }
  }
  function summary(records) {
    return { pages: C.groupPages(records).length, marks: Object.keys(records).filter(key => key.startsWith(C.PREFIX)).length, keys: Object.keys(records).length };
  }
  async function backup(records, sourceId) {
    validateRecords(records);
    // Previous migration metadata is not user editing data.
    const copy = structuredClone(records); delete copy[RECEIPT];
    return { format: 'pagetint-storage-backup', version: 1, sourceId, exportedAt: new Date().toISOString(),
      summary: summary(copy), sha256: await digest(copy), records: copy };
  }
  async function validateBackup(file) {
    if (!file || file.format !== 'pagetint-storage-backup' || file.version !== 1 || typeof file.sourceId !== 'string')
      throw new Error('请选择由 PageTint 数据迁移工具生成的备份文件，Markdown 不能用于迁移');
    validateRecords(file.records);
    if (Object.hasOwn(file.records, RECEIPT)) throw new Error('备份中包含保留字段');
    if (await digest(file.records) !== file.sha256) throw new Error('备份校验失败：文件内容不完整或已被修改');
    if (canonical(summary(file.records)) !== canonical(file.summary)) throw new Error('备份统计不一致');
    return file;
  }
  async function importBackup(storage, file, destinationId) {
    await validateBackup(file);
    if (destinationId === file.sourceId) throw new Error('当前还是原扩展，请先从 pagetint 目录加载新版，再到新版中导入');
    const existing = await storage.get(null), changes = {};
    for (const [key, value] of Object.entries(file.records)) {
      if (Object.hasOwn(existing, key) && canonical(existing[key]) !== canonical(value))
        throw new Error('新版扩展已有不同数据，已停止导入，未覆盖任何内容。请先备份目标数据后再处理');
      if (!Object.hasOwn(existing, key)) changes[key] = value;
    }
    if (Object.keys(changes).length) await storage.set(changes);
    const saved = await storage.get(Object.keys(file.records));
    const subset = Object.fromEntries(Object.keys(file.records).map(key => [key, saved[key]]));
    if (await digest(subset) !== file.sha256) throw new Error('写入后校验失败，请保留旧扩展与备份文件，重新导入');
    const receipt = { sourceId: file.sourceId, destinationId, sha256: file.sha256, ...file.summary, verifiedAt: new Date().toISOString() };
    await storage.set({ [RECEIPT]: receipt });
    return receipt;
  }
  const api = { RECEIPT, canonical, digest, summary, backup, validateBackup, importBackup };
  root.PageTintMigration = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
