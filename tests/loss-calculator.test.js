const assert = require('node:assert/strict');

const { calculateLossBreakdown } = require('../loss-calculator.js');

const catalog = {
  line: [{ name: '線路 A', weight: 2, price: 100, pts: 1.5 }],
  service: [{ name: '接戶線 B', weight: 1, price: 50, pts: 0.5 }],
  meter: [{ name: '電表 C', weight: 0, price: 800, pts: 2 }],
};

const breakdown = calculateLossBreakdown({
  wage: '250',
  laborHrs: '3',
  lossLines: [{ dbIdx: 0, qty: 10 }],
  lossSvc: [{ dbIdx: 0, qty: 4 }],
  lossMeter: [{ dbIdx: 0, qty: 2 }],
  lossRst: [{ dbIdx: 0, qty: 8 }, { dbIdx: 1, qty: 2 }],
}, catalog);

assert.equal(breakdown.line.totals.totalWeight, 20);
assert.equal(breakdown.line.totals.amount, 1000);
assert.equal(breakdown.service.totals.amount, 200);
assert.equal(breakdown.meter.totals.amount, 1600);
assert.equal(breakdown.lossTotal, 2800);
assert.equal(breakdown.restore.totals.totalWeight, 18);
assert.equal(breakdown.restoreCost, 900);
assert.equal(breakdown.restorePts, 13);
assert.equal(breakdown.accessoryCost, 38.2);
assert.equal(breakdown.workUnits, 0.1);
assert.equal(breakdown.wageCost, 150);
assert.equal(breakdown.travelCost, 25);
assert.equal(breakdown.materialBase, 938.2);
assert.equal(breakdown.miscCost, 65.7);
assert.equal(breakdown.handlingCost, 750);
assert.equal(breakdown.repairWithoutHandling, 1178.9);
assert.equal(breakdown.repairTotal, 1928.9);

const duplicates = calculateLossBreakdown({
  lossLines: [{ dbIdx: 0, qty: 1 }, { dbIdx: 0, qty: 2 }],
}, catalog);

assert.equal(duplicates.line.rows.length, 2);
assert.equal(duplicates.line.groups.length, 1);
assert.equal(duplicates.line.groups[0].qty, 3);
assert.equal(duplicates.line.groups[0].amount, 300);

const invalidRows = calculateLossBreakdown({
  lossLines: [
    { dbIdx: 0, qty: 0 },
    { dbIdx: 0, qty: -1 },
    { dbIdx: 99, qty: 5 },
  ],
}, catalog);

assert.deepEqual(invalidRows.line.rows, []);
assert.equal(invalidRows.lossTotal, 0);

console.log('loss calculator tests passed');
