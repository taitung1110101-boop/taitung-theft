const assert = require('node:assert/strict');

const ReportRepository = require('../report-repository.js');

function createFirestoreMock(){
  const calls = [];
  const documents = new Map();
  let queryDocuments = [];
  let nextId = 1;

  function snapshotFrom(items){
    return {
      empty: items.length === 0,
      forEach(callback){
        items.forEach(item => callback({ id: item.id, data: () => item.data }));
      },
    };
  }

  function createQuery(operations = []){
    return {
      orderBy(field, direction){ return createQuery([...operations, ['orderBy', field, direction]]); },
      where(field, operator, value){ return createQuery([...operations, ['where', field, operator, value]]); },
      limit(value){ return createQuery([...operations, ['limit', value]]); },
      async get(){
        calls.push({ type: 'query', operations });
        return snapshotFrom(queryDocuments);
      },
    };
  }

  const collection = {
    doc(id = `generated-${nextId++}`){
      return {
        id,
        async set(data){ calls.push({ type: 'set', id, data }); documents.set(id, data); },
        async get(){
          calls.push({ type: 'get', id });
          return { exists: documents.has(id), data: () => documents.get(id) };
        },
        async update(data){ calls.push({ type: 'update', id, data }); },
        async delete(){ calls.push({ type: 'delete', id }); },
      };
    },
    async add(data){
      const id = `added-${nextId++}`;
      calls.push({ type: 'add', id, data });
      return { id };
    },
    orderBy(field, direction){ return createQuery([['orderBy', field, direction]]); },
    where(field, operator, value){ return createQuery([['where', field, operator, value]]); },
  };

  return {
    calls,
    documents,
    setQueryDocuments(items){ queryDocuments = items; },
    firestore: {
      collection(name){
        assert.equal(name, 'reports');
        return collection;
      },
    },
  };
}

(async function(){
  const mock = createFirestoreMock();
  let timestampSequence = 0;
  const repository = ReportRepository.createFirestoreReportRepository({
    firestore: mock.firestore,
    serverTimestamp: () => ({ serverTimestamp: ++timestampSequence }),
    timestampFromDate: date => ({ timestampFromDate: date.toISOString() }),
  });

  assert.equal(Object.isFrozen(repository), true);

  const savedId = await repository.save({
    unit: '台東區處',
    reportDate: '2026-08-01',
    location1: '台東市',
    status: 'untrusted-status',
    docId: 'untrusted-id',
  }, 'done');
  assert.equal(savedId, 'generated-1');
  const setCall = mock.calls.find(call => call.type === 'set');
  assert.equal(setCall.data.unit, '台東區處');
  assert.equal(setCall.data.status, 'done');
  assert.equal(setCall.data.docId, 'generated-1');
  assert.deepEqual(setCall.data.createdAt, { serverTimestamp: 1 });
  assert.deepEqual(setCall.data.updatedAt, { serverTimestamp: 2 });

  mock.setQueryDocuments([
    { id: 'record-1', data: { reporter: '王小明', status: 'draft' } },
  ]);
  assert.deepEqual(await repository.list({ status: 'draft', limit: 25 }), [
    { id: 'record-1', data: { reporter: '王小明', status: 'draft' } },
  ]);
  assert.deepEqual(mock.calls.at(-1).operations, [
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 25],
    ['where', 'status', '==', 'draft'],
  ]);
  await repository.list();
  assert.deepEqual(mock.calls.at(-1).operations, [
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 50],
  ]);

  mock.documents.set('record-1', { reporter: '王小明' });
  assert.deepEqual(await repository.get('record-1'), { reporter: '王小明' });
  assert.equal(await repository.get('missing'), null);

  await repository.updateEditableFields('record-1', {
    reporter: '陳小華',
    location1: '成功鎮',
    caseNo: 'A-001',
    remarks: '已確認',
    status: 'done',
    createdAt: '不可覆寫',
  });
  const updateCall = mock.calls.find(call => call.type === 'update');
  assert.deepEqual(updateCall.data, {
    reporter: '陳小華',
    location1: '成功鎮',
    caseNo: 'A-001',
    remarks: '已確認',
    updatedAt: { serverTimestamp: 3 },
  });

  await repository.remove('record-1');
  assert.deepEqual(mock.calls.at(-1), { type: 'delete', id: 'record-1' });

  mock.setQueryDocuments([]);
  const monthStart = new Date('2026-08-01T00:00:00.000Z');
  const monthEnd = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(await repository.hasRecordsBetween(monthStart, monthEnd), false);
  assert.deepEqual(mock.calls.at(-1).operations, [
    ['where', 'createdAt', '>=', { timestampFromDate: monthStart.toISOString() }],
    ['where', 'createdAt', '<', { timestampFromDate: monthEnd.toISOString() }],
    ['limit', 1],
  ]);

  const noTheftId = await repository.saveNoTheft({
    reportDate: '2026-08-01',
    unit: '台東區處',
    location1: '2026年8月無失竊案件',
    reporter: '系統自動回報',
    totalLoss: '$0',
    totalRestore: '$0',
    remarks: '本月無案件',
    lossLines: [], lossSvc: [], lossRst: [], lossMeter: [],
    status: 'untrusted-status',
    docId: 'untrusted-id',
  });
  assert.equal(noTheftId, 'added-2');
  const addCall = mock.calls.find(call => call.type === 'add');
  assert.equal(addCall.data.status, 'no_theft');
  assert.equal('docId' in addCall.data, false);
  assert.deepEqual(addCall.data.createdAt, { serverTimestamp: 4 });
  assert.deepEqual(addCall.data.updatedAt, { serverTimestamp: 5 });

  console.log('report repository tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
