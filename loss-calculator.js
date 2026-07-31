(function(root, factory){
  const calculator = factory();
  if(typeof module === 'object' && module.exports) module.exports = calculator;
  root.LossCalculator = calculator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const ACCESSORY_RATE = 2940;
  const ACCESSORY_POINTS_BASE = 1000;
  const WORK_POINTS_BASE = 100;
  const WAGE_RATE = 1500;
  const TRAVEL_RATE = 250;
  const MISC_RATE = 0.07;

  function number(value){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round1(value){
    return Math.round(value * 10) / 10;
  }

  function calculateRows(rows, items){
    return (rows || []).flatMap(row => {
      const item = items[row.dbIdx];
      const qty = number(row.qty);
      if(!item || qty <= 0) return [];
      const weight = number(item.weight);
      const price = number(item.price);
      const pts = number(item.pts);
      return [{
        dbIdx: row.dbIdx,
        name: item.name || row.name || '',
        qty,
        weight,
        price,
        pts,
        totalWeight: qty * weight,
        amount: qty * price,
        totalPts: qty * pts,
      }];
    });
  }

  function groupRows(rows){
    const groups = new Map();
    rows.forEach(row => {
      const key = String(row.dbIdx);
      const current = groups.get(key);
      if(current){
        current.qty += row.qty;
        current.totalWeight += row.totalWeight;
        current.amount += row.amount;
        current.totalPts += row.totalPts;
      }else{
        groups.set(key, { ...row });
      }
    });
    return Array.from(groups.values());
  }

  function totalRows(rows){
    return rows.reduce((totals, row) => {
      totals.totalWeight += row.totalWeight;
      totals.amount += row.amount;
      totals.totalPts += row.totalPts;
      return totals;
    }, { totalWeight: 0, amount: 0, totalPts: 0 });
  }

  function calculateSection(rows, items){
    const calculatedRows = calculateRows(rows, items);
    return {
      rows: calculatedRows,
      groups: groupRows(calculatedRows),
      totals: totalRows(calculatedRows),
    };
  }

  function calculateLossBreakdown(data = {}, catalog = {}){
    const lineItems = catalog.line || [];
    const serviceItems = catalog.service || [];
    const meterItems = catalog.meter || [];
    const line = calculateSection(data.lossLines, lineItems);
    const service = calculateSection(data.lossSvc, serviceItems);
    const meter = calculateSection(data.lossMeter, meterItems);
    const restore = calculateSection(data.lossRst, [...lineItems, ...serviceItems]);

    const lossTotal = line.totals.amount + service.totals.amount + meter.totals.amount;
    const restoreCost = restore.totals.amount;
    const restorePts = restore.totals.totalPts;
    const accessoryCost = round1(restorePts / ACCESSORY_POINTS_BASE * ACCESSORY_RATE);
    const workUnits = round1(restorePts / WORK_POINTS_BASE);
    const wageCost = round1(workUnits * WAGE_RATE);
    const travelCost = round1(workUnits * TRAVEL_RATE);
    const materialBase = restoreCost + accessoryCost;
    const miscCost = round1(materialBase * MISC_RATE);
    const handlingCost = number(data.wage) * number(data.laborHrs);
    const repairWithoutHandling = round1(
      restoreCost + accessoryCost + wageCost + travelCost + miscCost
    );

    return {
      line,
      service,
      meter,
      restore,
      lossTotal,
      restoreCost,
      restorePts,
      accessoryCost,
      workUnits,
      wageCost,
      travelCost,
      materialBase,
      miscCost,
      handlingCost,
      repairWithoutHandling,
      repairTotal: repairWithoutHandling + handlingCost,
    };
  }

  return { calculateLossBreakdown };
});
