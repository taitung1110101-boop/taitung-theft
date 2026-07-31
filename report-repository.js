(function(root, factory){
  const reportDraft = typeof module === 'object' && module.exports
    ? require('./report-draft.js')
    : root.ReportDraft;
  const reportRepository = factory(reportDraft);
  if(typeof module === 'object' && module.exports) module.exports = reportRepository;
  root.ReportRepository = reportRepository;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(ReportDraft){
  'use strict';

  const EDITABLE_FIELDS = ['reporter', 'location1', 'caseNo', 'remarks'];
  const NO_THEFT_FIELDS = [
    'reportDate', 'unit', 'location1', 'reporter',
    'totalLoss', 'totalRestore', 'remarks',
    'lossLines', 'lossSvc', 'lossRst', 'lossMeter',
  ];

  function assertDependency(value, name){
    if(!value) throw new Error(`ReportRepository 缺少 ${name}`);
  }

  function pick(source, fields){
    const result = {};
    fields.forEach(field => {
      if(Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
    });
    return result;
  }

  function createFirestoreReportRepository({ firestore, serverTimestamp, timestampFromDate }){
    assertDependency(ReportDraft, 'ReportDraft');
    assertDependency(firestore, 'firestore');
    assertDependency(serverTimestamp, 'serverTimestamp');
    assertDependency(timestampFromDate, 'timestampFromDate');

    const reports = firestore.collection('reports');

    async function save(draft, status = 'draft'){
      const docRef = reports.doc();
      await docRef.set({
        ...ReportDraft.serialize(draft),
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        docId: docRef.id,
      });
      return docRef.id;
    }

    async function list({ status = 'all', limit = 50 } = {}){
      let query = reports.orderBy('createdAt', 'desc').limit(limit);
      if(status !== 'all') query = query.where('status', '==', status);
      const snapshot = await query.get();
      const records = [];
      snapshot.forEach(doc => records.push({ id: doc.id, data: doc.data() }));
      return records;
    }

    async function get(id){
      const snapshot = await reports.doc(id).get();
      return snapshot.exists ? snapshot.data() : null;
    }

    async function updateEditableFields(id, changes = {}){
      await reports.doc(id).update({
        ...pick(changes, EDITABLE_FIELDS),
        updatedAt: serverTimestamp(),
      });
    }

    async function remove(id){
      await reports.doc(id).delete();
    }

    async function hasRecordsBetween(start, end){
      const snapshot = await reports
        .where('createdAt', '>=', timestampFromDate(start))
        .where('createdAt', '<', timestampFromDate(end))
        .limit(1)
        .get();
      return !snapshot.empty;
    }

    async function saveNoTheft(report){
      const docRef = await reports.add({
        ...pick(report, NO_THEFT_FIELDS),
        status: 'no_theft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }

    return Object.freeze({
      save,
      list,
      get,
      updateEditableFields,
      remove,
      hasRecordsBetween,
      saveNoTheft,
    });
  }

  return { createFirestoreReportRepository };
});
