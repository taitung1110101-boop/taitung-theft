const assert = require('node:assert/strict');

global.window = global;
global.DB = {
  line: [{name:'線路電纜A',weight:2,price:100,pts:1.5}],
  service: [{name:'接戶線B',weight:1,price:50,pts:0.5}],
  meter: [{name:'電表C',price:800,pts:2}],
};

require('../loss-calculator.js');
require('../excel-report.js');

const model = buildExcelReportModel({
  unit:'鹿野服務所',unitAddr:'測試地址',unitTel:'089-000000',
  reportDate:'2026-06-25',theftTime:'10:30',reporter:'測試人員',outagHrs:'2',
  location1:'測試地點',location2:'A1～A2',lineName:'鹿野D/S',feeder:'鹿野',police:'都蘭',
  caseNo:'TEST-001',outageHomes:'3',impactValue:'1000',photos:'4',remarks:'測試備註',
  wage:'250',laborHrs:'3',
  lossLines:[{dbIdx:0,name:'線路電纜A',qty:10}],
  lossSvc:[{dbIdx:0,name:'接戶線B',qty:4}],
  lossMeter:[{dbIdx:0,name:'電表C',qty:2}],
  lossRst:[{dbIdx:0,name:'線路電纜A',qty:8},{dbIdx:1,name:'接戶線B',qty:2}],
});

assert.equal(model.district,'成功');
assert.equal(model.info.compact,'20260625');
assert.equal(model.info.ampm,'上午');
assert.equal(model.info.h12,10);
assert.equal(model.line.length,1);
assert.equal(model.service.length,1);
assert.equal(model.meter.length,1);
assert.equal(model.lossTotal,2800);
assert.equal(model.restoreCost,900);
assert.equal(model.restorePts,13);
assert.equal(model.handling,750);
assert.equal(model.fullLocation,'測試地點／A1～A2');

assert.throws(()=>buildExcelReportModel({...model,lossLines:[],lossSvc:[],lossMeter:[],lossRst:[]}),/至少填寫一項失竊材料/);

console.log('excel-report model tests passed');
