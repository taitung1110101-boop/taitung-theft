(function(){
'use strict';

const REPORT_TEMPLATE_URL = 'templates/電力線路失竊報表範本.xlsx';
const CALC_SHEET_NAME = '損失及修復費用計算式';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const { calculateLossBreakdown } = window.LossCalculator || {};

const POLICE_DISTRICT = {
  '土坂':'大武','太麻里':'大武','台板':'大武','正興':'大武','多良':'大武','尚武':'大武','金峰':'大武','金崙':'大武','美和':'大武','森永':'大武','新化':'大武','達仁':'大武','歷坵':'大武','大武':'大武',
  '關山':'關山','加南':'關山','鹿野':'關山','瑞豐':'關山','瑞源':'關山','池上':'關山','錦安':'關山','向陽':'關山','利稻':'關山','海端':'關山','初來':'關山','崁頂':'關山','龍泉':'關山','霧鹿':'關山','延平':'關山','武陵':'關山','紅葉':'關山','鸞山':'關山',
  '中興':'台東','綠島':'台東','永樂':'台東','卑南':'台東','知本':'台東','南王':'台東','馬蘭':'台東','富岡':'台東','豐里':'台東','蘭嶼':'台東','建蘭':'台東',
  '新豐':'成功','東河':'成功','都蘭':'成功','泰源':'成功','都歷':'成功','忠孝':'成功','寧埔':'成功','竹湖':'成功','長濱':'成功','三間':'成功','樟原':'成功'
};

function parseXml(text){
  const doc = new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('Excel 範本 XML 解析失敗');
  return doc;
}

function serializeXml(doc){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+new XMLSerializer().serializeToString(doc.documentElement);
}

function colToNum(col){
  return [...col].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);
}

function cellParts(ref){
  const m=/^([A-Z]+)(\d+)$/.exec(ref);
  return {col:m[1],row:Number(m[2])};
}

function findCell(doc,ref){
  return Array.from(doc.getElementsByTagNameNS(MAIN_NS,'c')).find(c=>c.getAttribute('r')===ref)||null;
}

function ensureCell(doc,ref){
  let cell=findCell(doc,ref);
  if(cell) return cell;
  const {col,row}=cellParts(ref);
  const sheetData=doc.getElementsByTagNameNS(MAIN_NS,'sheetData')[0];
  let rowEl=Array.from(doc.getElementsByTagNameNS(MAIN_NS,'row')).find(r=>Number(r.getAttribute('r'))===row);
  if(!rowEl){
    rowEl=doc.createElementNS(MAIN_NS,'row');
    rowEl.setAttribute('r',String(row));
    const next=Array.from(sheetData.children).find(r=>Number(r.getAttribute('r'))>row);
    sheetData.insertBefore(rowEl,next||null);
  }
  cell=doc.createElementNS(MAIN_NS,'c');
  cell.setAttribute('r',ref);
  const next=Array.from(rowEl.children).find(c=>colToNum(cellParts(c.getAttribute('r')).col)>colToNum(col));
  rowEl.insertBefore(cell,next||null);
  return cell;
}

function writeCell(doc,ref,value){
  const cell=ensureCell(doc,ref);
  while(cell.firstChild) cell.removeChild(cell.firstChild);
  if(typeof value==='number' && Number.isFinite(value)){
    cell.removeAttribute('t');
    const v=doc.createElementNS(MAIN_NS,'v');
    v.textContent=String(value);
    cell.appendChild(v);
    return;
  }
  cell.setAttribute('t','inlineStr');
  const is=doc.createElementNS(MAIN_NS,'is');
  const t=doc.createElementNS(MAIN_NS,'t');
  const text=value==null?'':String(value);
  if(/^\s|\s$/.test(text)) t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  t.textContent=text;
  is.appendChild(t);
  cell.appendChild(is);
}

function clearFormulaCells(doc){
  const cells=Array.from(doc.getElementsByTagNameNS(MAIN_NS,'c')).filter(c=>c.getElementsByTagNameNS(MAIN_NS,'f').length);
  cells.forEach(c=>writeCell(doc,c.getAttribute('r'),''));
}

function clearRefs(doc,refs){ refs.forEach(ref=>writeCell(doc,ref,'')); }

function rowRefs(cols,start,end){
  const refs=[];
  for(let row=start;row<=end;row++) for(const col of cols) refs.push(col+row);
  return refs;
}

function excelSerial(dateText,timeText='00:00'){
  if(!dateText) return '';
  const [y,m,d]=dateText.split('-').map(Number);
  const [hh,mm]=(timeText||'00:00').split(':').map(Number);
  return Date.UTC(y,m-1,d,hh||0,mm||0)/86400000+25569;
}

function dateInfo(dateText,timeText){
  const [year,month,day]=(dateText||'').split('-').map(Number);
  const [hour,minute]=(timeText||'00:00').split(':').map(Number);
  const h24=hour||0;
  return {
    year,month,day,hour:h24,minute:minute||0,
    compact:dateText?`${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`:'',
    rocYear:year?year-1911:'',
    ampm:h24<12?'上午':'下午',
    h12:h24===0?12:(h24>12?h24-12:h24),
    serial:excelSerial(dateText,timeText)
  };
}

function collectReportModel(data){
  if(typeof calculateLossBreakdown !== 'function') throw new Error('LossCalculator 尚未載入');
  const breakdown=calculateLossBreakdown(data,DB);
  const line=breakdown.line.groups;
  const service=breakdown.service.groups;
  const meter=breakdown.meter.groups;
  const restore=breakdown.restore.groups;
  if(line.length>5) throw new Error('線路電纜品項超過 Excel 版型上限 5 項');
  if(service.length>3) throw new Error('接戶線品項超過 Excel 版型上限 3 項');
  if(meter.length>3) throw new Error('電表／比流器品項超過 Excel 版型上限 3 項');
  if(restore.length>11) throw new Error('復舊材料品項超過 Excel 版型上限 11 項');
  if(!line.length&&!service.length&&!meter.length) throw new Error('請至少填寫一項失竊材料');

  const {
    lossTotal,restoreCost,restorePts,
    accessoryCost:accessory,workUnits,wageCost,travelCost:travel,
    materialBase,miscCost:misc,handlingCost:handling,
    repairWithoutHandling,repairTotal
  }=breakdown;
  const info=dateInfo(data.reportDate,data.theftTime);
  return {
    ...data,line,service,meter,restore,info,
    district:POLICE_DISTRICT[data.police]||'',
    lossTotal,restoreCost,restorePts,accessory,workUnits,wageCost,travel,materialBase,misc,handling,
    repairWithoutHandling,repairTotal,
    fullLocation:data.location1+(data.location2?`／${data.location2}`:'')
  };
}

async function loadWorkbook(){
  if(typeof JSZip==='undefined') throw new Error('Excel 元件尚未載入');
  const res=await fetch(REPORT_TEMPLATE_URL,{cache:'no-store'});
  if(!res.ok) throw new Error(`Excel 範本下載失敗（HTTP ${res.status}）`);
  const zip=await JSZip.loadAsync(await res.arrayBuffer());
  const workbook=parseXml(await zip.file('xl/workbook.xml').async('text'));
  const rels=parseXml(await zip.file('xl/_rels/workbook.xml.rels').async('text'));
  const relMap={};
  Array.from(rels.getElementsByTagNameNS('*','Relationship')).forEach(r=>relMap[r.getAttribute('Id')]=r.getAttribute('Target'));
  const sheets={};
  Array.from(workbook.getElementsByTagNameNS(MAIN_NS,'sheet')).forEach((s,index)=>{
    const name=s.getAttribute('name');
    const rid=s.getAttributeNS(REL_NS,'id')||s.getAttribute('r:id');
    const target=relMap[rid].replace(/^\//,'');
    sheets[name]={node:s,index,path:target.startsWith('xl/')?target:`xl/${target}`};
  });
  return {zip,workbook,rels,sheets};
}

async function getSheetDoc(book,name){
  const sheet=book.sheets[name];
  if(!sheet) throw new Error(`Excel 範本缺少「${name}」分頁`);
  if(!sheet.doc) sheet.doc=parseXml(await book.zip.file(sheet.path).async('text'));
  return sheet.doc;
}

function fillCalculation(doc,m){
  clearFormulaCells(doc);
  clearRefs(doc,['B1','C1','G1','B2','D2','F2','H2','B3','B4','B5','E5','B6','E6','B7','B8','E8','H8','K8','B9','B10','E10','I10','B11','I13','I14','B15','D15','E15']);
  clearRefs(doc,rowRefs(['A','B','C','D','E','F','G','H','I','J'],20,32));
  clearRefs(doc,rowRefs(['A','B','C','D','E','F','G','H','I','J'],36,46));
  const i=m.info;
  const values={
    B1:m.unit,C1:m.unitAddr,G1:m.unitTel,B2:i.compact,D2:i.ampm,F2:i.h12,H2:i.minute,
    B3:m.location1,B4:m.location2,B5:m.lineName,E5:m.feeder,B6:m.district,E6:m.police,
    B7:m.remarks,B8:Number(m.impactValue)||0,E8:Number(m.outageHomes)||0,H8:Number(m.outagHrs)||0,K8:Number(m.photos)||0,
    B9:m.caseNo,B10:i.serial,E10:m.reporter,I10:i.serial,B11:'',I13:i.serial,I14:m.location1,
    B15:Number(m.wage)||0,D15:Number(m.laborHrs)||0,E15:m.handling,
    G33:m.lossTotal,H33:0,H47:m.restoreCost,J47:m.restorePts,
    B50:m.restorePts,D50:2940,E50:m.accessory,
    B54:m.workUnits,D54:1500,F54:1,G54:m.wageCost,
    B57:m.workUnits,D57:250,F57:1,G57:m.travel,
    B60:m.materialBase,D60:0.07,E60:m.misc,
    B63:m.restoreCost,D63:m.accessory,F63:m.wageCost,G63:m.travel,H63:m.misc,I63:m.repairWithoutHandling
  };
  Object.entries(values).forEach(([ref,val])=>writeCell(doc,ref,val));

  function lossRows(items,start,unit){
    items.forEach((x,idx)=>{
      const r=start+idx;
      writeCell(doc,'A'+r,x.name);writeCell(doc,'B'+r,x.qty);writeCell(doc,'C'+r,unit);
      writeCell(doc,'D'+r,unit==='M'?x.totalWeight:'');writeCell(doc,'E'+r,unit==='M'?'KG':'');
      writeCell(doc,'F'+r,x.price);writeCell(doc,'G'+r,x.amount);
    });
  }
  lossRows(m.line,20,'M');lossRows(m.service,26,'M');lossRows(m.meter,30,'具');
  m.restore.forEach((x,idx)=>{
    const r=36+idx;
    writeCell(doc,'A'+r,x.name);writeCell(doc,'B'+r,x.qty);writeCell(doc,'C'+r,'M');
    writeCell(doc,'D'+r,x.totalWeight);writeCell(doc,'E'+r,'KG');writeCell(doc,'F'+r,x.price);
    writeCell(doc,'H'+r,x.amount);writeCell(doc,'I'+r,x.pts);writeCell(doc,'J'+r,x.totalPts);
  });
}

function fillSupplement(doc,m){
  clearFormulaCells(doc);
  const values={D2:m.location1,D3:m.location2,D4:m.info.compact,G5:m.caseNo,D7:m.lossTotal,D8:m.repairTotal,
    D9:Number(m.impactValue)||0,D10:Number(m.outageHomes)||0,D11:Number(m.outagHrs)||0,D12:Number(m.photos)||0,B14:m.remarks};
  Object.entries(values).forEach(([ref,val])=>writeCell(doc,ref,val));
}

function fillInvestigation(doc,m,items,unit){
  clearFormulaCells(doc);
  clearRefs(doc,rowRefs(['G','N','P','Q','T','U'],11,15));
  const i=m.info;
  const values={
    S2:m.unit,A3:i.serial,S3:m.unitAddr,S4:m.unitTel,
    G5:`${i.compact}${i.ampm}${i.h12}時${String(i.minute).padStart(2,'0')}分   發現失竊`,
    G6:'良好',G7:m.location1,G8:m.location2,G9:`${m.lineName}  變電所  ${m.feeder}  饋線`,
    G17:`${m.district} 分局 ${m.police} 分駐、派出所`,G18:i.serial,G29:`${m.police} 分駐、派出所`
  };
  items.forEach((x,idx)=>{
    const r=11+idx;
    values['G'+r]=x.name;values['N'+r]=x.qty;values['P'+r]=unit;
    values['Q'+r]=unit==='M'?x.totalWeight:'';values['T'+r]=unit==='M'?'KG':'';values['U'+r]=x.amount;
  });
  if(items.length<5) values['G'+(11+items.length)]='以下空白';
  values.U16=items.reduce((s,x)=>s+x.amount,0);
  Object.entries(values).forEach(([ref,val])=>writeCell(doc,ref,val));
}

function fillRegistry(doc,m){
  clearFormulaCells(doc);
  writeCell(doc,'D2',m.info.serial);writeCell(doc,'E2',m.info.serial);writeCell(doc,'J34',m.lossTotal);
  const groups=[
    {items:m.line,loss:m.line.reduce((s,x)=>s+x.amount,0),unit:'M'},
    {items:m.service,loss:m.service.reduce((s,x)=>s+x.amount,0),unit:'M'},
    {items:m.meter,loss:m.meter.reduce((s,x)=>s+x.amount,0),unit:'具'}
  ].filter(g=>g.items.length);
  const starts=[4,10,16];
  groups.forEach((group,index)=>{
    const start=starts[index];
    writeCell(doc,'A'+start,index+1);
    if(index===0){
      writeCell(doc,'B'+start,m.info.serial);writeCell(doc,'C'+start,m.info.compact);
      writeCell(doc,'D'+start,m.fullLocation);writeCell(doc,'E'+start,`${m.district}分局`);
      writeCell(doc,'E7',`${m.police}分駐所`);writeCell(doc,'K'+start,m.reporter);
      writeCell(doc,'L5',m.unit);writeCell(doc,'L8',m.unitTel);
    }else{
      ['B','C','D','E','K','L'].forEach(col=>writeCell(doc,col+start,'〃'));
    }
    group.items.forEach((x,idx)=>writeCell(doc,'G'+(start+idx),`${x.name} ${x.qty}${group.unit}`));
    writeCell(doc,'J'+start,group.loss);
  });
}

function configureWorkbook(book,m){
  const visible=new Set(['sheet2','補充資料表','電纜失竊案登記表']);
  if(m.line.length) visible.add('現場調查表（線路）');
  if(m.service.length) visible.add('現場調查表（接戶線）');
  if(m.meter.length) visible.add('現場調查表（電表）');
  Object.entries(book.sheets).forEach(([name,sheet])=>{
    if(visible.has(name)) sheet.node.removeAttribute('state');
    else sheet.node.setAttribute('state','hidden');
  });
  book.sheets.sheet2.node.setAttribute('name',CALC_SHEET_NAME);
  const view=book.workbook.getElementsByTagNameNS(MAIN_NS,'workbookView')[0];
  if(view){view.setAttribute('activeTab',String(book.sheets.sheet2.index));view.setAttribute('firstSheet',String(book.sheets.sheet2.index));}
  const calc=book.workbook.getElementsByTagNameNS(MAIN_NS,'calcPr')[0];
  if(calc){calc.setAttribute('calcMode','auto');calc.setAttribute('fullCalcOnLoad','1');calc.setAttribute('forceFullCalc','1');}
  const defined=book.workbook.getElementsByTagNameNS(MAIN_NS,'definedNames')[0];
  if(defined){
    Array.from(defined.getElementsByTagNameNS(MAIN_NS,'definedName')).forEach(n=>{
      if(n.textContent.startsWith('sheet2!')) n.textContent=`'${CALC_SHEET_NAME}'!`+n.textContent.slice(7);
    });
    ['現場調查表（接戶線）','現場調查表（電表）'].forEach(name=>{
      const id=String(book.sheets[name].index);
      let node=Array.from(defined.getElementsByTagNameNS(MAIN_NS,'definedName')).find(n=>n.getAttribute('name')==='_xlnm.Print_Area'&&n.getAttribute('localSheetId')===id);
      if(!node){node=book.workbook.createElementNS(MAIN_NS,'definedName');node.setAttribute('name','_xlnm.Print_Area');node.setAttribute('localSheetId',id);defined.appendChild(node);}
      node.textContent=`'${name}'!$A$1:$AA$44`;
    });
  }
}

async function downloadExcelReport(data){
  const m=collectReportModel(data||collectFormData());
  const book=await loadWorkbook();
  const calc=await getSheetDoc(book,'sheet2');
  const supplement=await getSheetDoc(book,'補充資料表');
  const line=await getSheetDoc(book,'現場調查表（線路）');
  const service=await getSheetDoc(book,'現場調查表（接戶線）');
  const meter=await getSheetDoc(book,'現場調查表（電表）');
  const registry=await getSheetDoc(book,'電纜失竊案登記表');
  fillCalculation(calc,m);fillSupplement(supplement,m);
  fillInvestigation(line,m,m.line,'M');fillInvestigation(service,m,m.service,'M');fillInvestigation(meter,m,m.meter,'具');
  fillRegistry(registry,m);configureWorkbook(book,m);
  for(const [name,sheet] of Object.entries(book.sheets)){
    if(sheet.doc){
      let xml=serializeXml(sheet.doc);
      xml=xml.replace(/sheet2!/g,`'${CALC_SHEET_NAME}'!`);
      book.zip.file(sheet.path,xml);
    }
  }
  book.zip.file('xl/workbook.xml',serializeXml(book.workbook));
  const blob=await book.zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'_').trim();
  const filename=`${m.info.compact||'未填日期'}_${safe(m.unit)||'未填單位'}_電力線路失竊報表.xlsx`;
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  return filename;
}

window.POLICE_DISTRICT=POLICE_DISTRICT;
window.downloadExcelReport=downloadExcelReport;
window.buildExcelReportModel=collectReportModel;
})();
