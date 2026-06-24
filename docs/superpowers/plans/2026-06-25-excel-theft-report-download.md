# Excel 失竊報表下載 Implementation Plan

## 工作項目

1. 將舊 `.xls` 唯讀轉成無巨集 `.xlsx`，清除範例資料及不需要分頁。
2. 以 JSZip 讀取範本，使用 Open XML 只更新指定儲存格與分頁可見性。
3. 將完成送出流程接到 Excel 產生器，並保留重試下載按鈕。
4. 驗證計算模型、Open XML 輸出、條件式分頁、Excel 開啟及 PDF 列印版面。
5. commit、push `main`，等待 GitHub Pages deployment success，再驗證正式資源與下載流程。

## 主要檔案

- `index.html`
- `excel-report.js`
- `templates/電力線路失竊報表範本.xlsx`
- `vendor/jszip.min.js`
- `tests/excel-report.test.js`

## 驗證案例

- 線路、接戶線、電表同時填寫：三張現場調查表都顯示。
- 只填兩類：未填類型分頁隱藏。
- 分駐所「都蘭」自動帶入「成功分局」。
- 計算式、補充資料與登記表合計一致。
- Excel 匯出 PDF 後，原版框線、分頁與簽核欄保持一致。
