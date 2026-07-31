(function(root, factory){
  const reportDraft = factory();
  if(typeof module === 'object' && module.exports) module.exports = reportDraft;
  root.ReportDraft = reportDraft;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const TEXT_FIELDS = [
    'unit', 'unitAddr', 'unitTel',
    'reportDate', 'theftTime',
    'reporter', 'outagHrs',
    'location1', 'location2',
    'lineName', 'feeder', 'police',
    'caseNo', 'outageHomes', 'impactValue', 'photos',
    'remarks', 'wage', 'laborHrs',
    'totalLoss', 'totalRestore',
  ];

  const ROW_FIELDS = {
    lossLines: 'line',
    lossSvc: 'service',
    lossRst: 'restore',
    lossMeter: 'meter',
  };

  const OPTION_FIELDS = {
    customLineNames: 'lineName',
    customFeeders: 'feeder',
    customPolice: 'police',
  };

  function asRecord(value){
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asText(value){
    return value == null ? '' : String(value);
  }

  function asIndex(value){
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 ? index : -1;
  }

  function asQuantity(value){
    const quantity = Number(value);
    return Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
  }

  function itemsFor(section, catalog){
    const source = asRecord(catalog);
    if(section === 'restore'){
      const hasLine = Array.isArray(source.line);
      const hasService = Array.isArray(source.service);
      return hasLine || hasService
        ? [...(hasLine ? source.line : []), ...(hasService ? source.service : [])]
        : null;
    }

    return Array.isArray(source[section]) ? source[section] : null;
  }

  function normalizeRow(value, items){
    const row = asRecord(value);
    const sourceIndex = asIndex(row.dbIdx);
    let name = asText(row.name);
    let dbIdx = sourceIndex;

    if(items){
      const nameIndex = name ? items.findIndex(item => asText(item?.name) === name) : -1;
      if(nameIndex >= 0){
        dbIdx = nameIndex;
      }else if(sourceIndex < items.length && (!name || asText(items[sourceIndex]?.name) === name)){
        dbIdx = sourceIndex;
        name = name || asText(items[sourceIndex]?.name);
      }else{
        dbIdx = -1;
      }
    }

    if(dbIdx < 0 && !name) return null;
    return Object.freeze({ dbIdx, name, qty: asQuantity(row.qty) });
  }

  function normalizeRows(value, items){
    const rows = Array.isArray(value) ? value : [];
    return Object.freeze(rows.flatMap(row => {
      const normalized = normalizeRow(row, items);
      return normalized ? [normalized] : [];
    }));
  }

  function normalizeOptions(value, selectedValue){
    const options = Array.isArray(value) ? value : [];
    const seen = new Set();
    const normalized = [];
    [...options, selectedValue].forEach(option => {
      const text = asText(option);
      if(!text || seen.has(text)) return;
      seen.add(text);
      normalized.push(text);
    });
    return Object.freeze(normalized);
  }

  function hydrate(value = {}, catalog = {}){
    const source = asRecord(value);
    const draft = {};

    TEXT_FIELDS.forEach(field => { draft[field] = asText(source[field]); });
    Object.entries(ROW_FIELDS).forEach(([field, section]) => {
      draft[field] = normalizeRows(source[field], itemsFor(section, catalog));
    });
    Object.entries(OPTION_FIELDS).forEach(([field, selectedField]) => {
      draft[field] = normalizeOptions(source[field], draft[selectedField]);
    });

    return Object.freeze(draft);
  }

  function serialize(value){
    const draft = hydrate(value);
    const serialized = {};

    TEXT_FIELDS.forEach(field => { serialized[field] = draft[field]; });
    Object.keys(ROW_FIELDS).forEach(field => {
      serialized[field] = draft[field].map(row => ({ ...row }));
    });
    Object.keys(OPTION_FIELDS).forEach(field => {
      serialized[field] = [...draft[field]];
    });

    return serialized;
  }

  function update(value, patch = {}, catalog = {}){
    return hydrate({ ...serialize(value), ...asRecord(patch) }, catalog);
  }

  return { hydrate, update, serialize };
});
