const assert = require('node:assert/strict');

const ReportDraft = require('../report-draft.js');

const catalog = {
  line: [
    { name: '硬銅線 22mm²' },
    { name: '鋁線 50mm²' },
  ],
  service: [{ name: '接戶線 14mm²' }],
  meter: [{ name: '電子式電表' }],
};

const currentRecord = {
  unit: '台東服務所',
  unitAddr: '台東市測試路 1 號',
  unitTel: '089-000000',
  reportDate: '2026-07-31',
  theftTime: '08:30',
  reporter: '測試人員',
  outagHrs: '2',
  location1: '台東市測試路',
  location2: 'A1 至 A2',
  lineName: '自訂線路',
  feeder: '自訂饋線',
  police: '自訂派出所',
  caseNo: 'TEST-001',
  outageHomes: '3',
  impactValue: '1000',
  photos: '4',
  remarks: '測試備註',
  wage: '250',
  laborHrs: '4',
  totalLoss: '$1,000',
  totalRestore: '$500',
  lossLines: [{ dbIdx: 0, name: '硬銅線 22mm²', qty: 10 }],
  lossSvc: [{ dbIdx: 0, name: '接戶線 14mm²', qty: 2 }],
  lossRst: [{ dbIdx: 1, name: '鋁線 50mm²', qty: 8 }],
  lossMeter: [{ dbIdx: 0, name: '電子式電表', qty: 1 }],
  customLineNames: ['既有線路', '自訂線路', '自訂線路'],
  customFeeders: ['自訂饋線'],
  customPolice: [],
  status: 'done',
  docId: 'firestore-id',
  createdAt: { seconds: 1 },
  updatedAt: { seconds: 2 },
};

const hydrated = ReportDraft.hydrate(currentRecord, catalog);
const serialized = ReportDraft.serialize(hydrated);

assert.equal(Object.isFrozen(hydrated), true);
assert.equal(Object.isFrozen(hydrated.lossLines), true);
assert.deepEqual(serialized.lossLines, currentRecord.lossLines);
assert.deepEqual(serialized.lossSvc, currentRecord.lossSvc);
assert.deepEqual(serialized.lossRst, currentRecord.lossRst);
assert.deepEqual(serialized.lossMeter, currentRecord.lossMeter);
assert.deepEqual(serialized.customLineNames, ['既有線路', '自訂線路']);
assert.deepEqual(serialized.customFeeders, ['自訂饋線']);
assert.deepEqual(serialized.customPolice, ['自訂派出所']);
assert.equal('status' in serialized, false);
assert.equal('docId' in serialized, false);
assert.equal('createdAt' in serialized, false);
assert.equal('updatedAt' in serialized, false);
assert.deepEqual(
  ReportDraft.serialize(ReportDraft.hydrate(JSON.parse(JSON.stringify(serialized)), catalog)),
  serialized
);

const reorderedCatalog = {
  ...catalog,
  line: [catalog.line[1], catalog.line[0]],
};
const reordered = ReportDraft.hydrate(currentRecord, reorderedCatalog);
assert.equal(reordered.lossLines[0].dbIdx, 1);
assert.equal(reordered.lossLines[0].name, '硬銅線 22mm²');
assert.equal(reordered.lossRst[0].dbIdx, 0);

const missingCatalogItem = ReportDraft.hydrate(currentRecord, {
  ...catalog,
  line: [{ name: '鋁線 50mm²' }],
});
assert.deepEqual(missingCatalogItem.lossLines[0], {
  dbIdx: -1,
  name: '硬銅線 22mm²',
  qty: 10,
});

const legacyRecord = ReportDraft.hydrate({
  unit: '舊服務所',
  reportDate: 20260701,
  location1: '舊資料地點',
  lineName: '舊自訂線路',
  lossLines: [{ dbIdx: '0', qty: '3' }],
  lossSvc: null,
  lossMeter: [null, {}],
  status: 'draft',
}, catalog);

assert.equal(legacyRecord.reportDate, '20260701');
assert.deepEqual(legacyRecord.lossLines[0], {
  dbIdx: 0,
  name: '硬銅線 22mm²',
  qty: 3,
});
assert.deepEqual(legacyRecord.lossSvc, []);
assert.deepEqual(legacyRecord.lossMeter, []);
assert.deepEqual(legacyRecord.customLineNames, ['舊自訂線路']);
assert.equal(legacyRecord.remarks, '');

const updated = ReportDraft.update(hydrated, {
  reporter: '更新後人員',
  lossLines: [{ dbIdx: 1, name: '鋁線 50mm²', qty: -5 }],
}, catalog);

assert.equal(hydrated.reporter, '測試人員');
assert.equal(updated.reporter, '更新後人員');
assert.deepEqual(updated.lossLines[0], {
  dbIdx: 1,
  name: '鋁線 50mm²',
  qty: 0,
});

console.log('report draft tests passed');
