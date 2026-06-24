# Excel 自主檢核表下載 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將「列印檢核表」改為下載保留原始格式的空白 `.xlsx` 自主檢核表。

**Architecture:** 使用 Microsoft Excel 將使用者提供的舊 `.xls` 唯讀轉存為網站靜態 `.xlsx` 範本。`index.html` 只提供同站相對路徑下載，不解析或重建活頁簿，因此不使用 SheetJS，也不加入本表不需要的 XML 寫入程式。

**Tech Stack:** HTML、GitHub Pages、Microsoft Excel、PowerShell、Python 標準函式庫 `zipfile`/`xml.etree.ElementTree`

## Global Constraints

- 保留黃色章節列、框線、字型、粗體、欄寬、列高、列印設定及簽核欄。
- 不從網頁寫入任何資料；確認欄與簽核欄保持空白。
- 現有檢核表預覽與其他頁面功能不變。
- 不使用 SheetJS，不為本表新增 XML 寫入引擎。
- 完成後啟動本機網站驗證、commit、push 並確認 GitHub Pages。

---

### Task 1: 建立並驗證空白 `.xlsx` 範本

**Files:**
- Source: `D:\失竊調查表\不使用的舊檔\1.報損作業自主檢核表(得知失竊發生後第一步驟先印這張出來勾選).xls`
- Create: `templates/報損作業自主檢核表.xlsx`

**Interfaces:**
- Consumes: 使用者提供的舊式 Excel 檢核表。
- Produces: 靜態 Open XML 活頁簿 `templates/報損作業自主檢核表.xlsx`。

- [ ] **Step 1: 驗證目標範本尚未存在**

```powershell
if (Test-Path -LiteralPath 'templates\報損作業自主檢核表.xlsx') { throw '範本不應在轉換前存在' }
```

Expected: PASS，無輸出。

- [ ] **Step 2: 使用 Microsoft Excel 轉存，不變更來源檔**

```powershell
$source = 'D:\失竊調查表\不使用的舊檔\1.報損作業自主檢核表(得知失竊發生後第一步驟先印這張出來勾選).xls'
$target = (Join-Path $PWD 'templates\報損作業自主檢核表.xlsx')
New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $excel.Workbooks.Open($source, 0, $true)
$workbook.SaveAs($target, 51)
$workbook.Close($false)
$excel.Quit()
```

Expected: `.xlsx` 建立成功，來源 `.xls` 修改時間不變。

- [ ] **Step 3: 驗證 Open XML 結構與空白欄位**

```python
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

path = Path("templates/報損作業自主檢核表.xlsx")
assert path.exists() and path.stat().st_size > 0
with ZipFile(path) as archive:
    names = set(archive.namelist())
    assert "xl/workbook.xml" in names
    assert "xl/worksheets/sheet1.xml" in names
    sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    values = {cell.attrib["r"]: cell.find("m:v", ns) for cell in sheet.findall(".//m:c", ns) if cell.attrib.get("r", "").startswith("C")}
    for row in list(range(6, 16)) + list(range(17, 24)) + list(range(25, 31)):
        value = values.get(f"C{row}")
        assert value is None or value.text in (None, "")
```

Expected: PASS；檔案為有效 Open XML，23 個確認欄保持空白。

- [ ] **Step 4: 用 Excel 唯讀核對工作表與列印結構**

確認工作表 `工作表1`、UsedRange `$A$1:$D$36`、PrintArea `$A$1:$C$36`、FitToPagesWide `1`、FitToPagesTall `1`。

Expected: Excel 無修復警告，結構值與來源 `.xls` 相同。

- [ ] **Step 5: 匯出來源與轉換後 PDF 並視覺比對**

以 Excel 將來源與目標各自唯讀匯出暫存 PDF，再用 Poppler 渲染第一頁 PNG。

Expected: 兩份皆為單頁 A4 直式；標題、三段黃色章節列、23 個確認欄、備註與兩組簽核欄一致，沒有裁切或重疊。完成後刪除暫存檔。

### Task 2: 將網頁按鈕改為靜態 Excel 下載

**Files:**
- Modify: `index.html:383`
- Test: `index.html` 靜態斷言及本機下載流程

**Interfaces:**
- Consumes: `templates/報損作業自主檢核表.xlsx`。
- Produces: 顯示「下載 Excel 檢核表」的同站下載連結。

- [ ] **Step 1: 執行變更前斷言並確認失敗**

```powershell
$html = Get-Content -Raw -Encoding UTF8 index.html
if ($html -notmatch 'href="templates/報損作業自主檢核表\.xlsx"') { throw '尚未加入 Excel 範本下載連結' }
```

Expected: FAIL with `尚未加入 Excel 範本下載連結`。

- [ ] **Step 2: 實作最小 HTML 變更**

```html
<a class="btn btn-primary btn-sm no-print" href="templates/報損作業自主檢核表.xlsx" download="報損作業自主檢核表.xlsx">📥 下載 Excel 檢核表</a>
```

只替換現有按鈕；不改預覽內容，也不順手刪除既有 `printChecklist()`。

- [ ] **Step 3: 執行靜態驗證並確認通過**

```powershell
$html = Get-Content -Raw -Encoding UTF8 index.html
if ($html -notmatch 'href="templates/報損作業自主檢核表\.xlsx"') { throw '缺少下載連結' }
if ($html -notmatch 'download="報損作業自主檢核表\.xlsx"') { throw '缺少下載檔名' }
if ($html -notmatch '📥 下載 Excel 檢核表') { throw '按鈕文字錯誤' }
if ($html -notmatch 'id="checklist-print-area"') { throw '檢核表預覽遭移除' }
```

Expected: PASS，無輸出。

- [ ] **Step 4: 啟動本機網站並驗證下載**

```powershell
python -m http.server 8000
```

以桌面與 390px 手機寬度開啟 `http://127.0.0.1:8000/`。點擊後須下載 `報損作業自主檢核表.xlsx`，HTTP 200，下載位元組與範本完全相同。

Expected: 下載成功；現有預覽和其他分頁仍可開啟。

### Task 3: 版本管控與部署驗證

**Files:**
- Include: `docs/superpowers/plans/2026-06-24-excel-checklist-download.md`
- Include: `templates/報損作業自主檢核表.xlsx`
- Include: `index.html`

**Interfaces:**
- Consumes: 已通過本機驗證的範本與 HTML。
- Produces: GitHub `main` 上可自動部署的完整功能。

- [ ] **Step 1: 檢查變更範圍**

```powershell
git status --short
git diff --check
git diff -- index.html
```

Expected: 只有計畫、範本和 `index.html` 變更；`git diff --check` 無錯誤。

- [ ] **Step 2: Commit**

```powershell
git add docs/superpowers/plans/2026-06-24-excel-checklist-download.md templates/報損作業自主檢核表.xlsx index.html
git commit -m "改用 Excel 範本下載自主檢核表"
```

Expected: 建立繁體中文 commit，工作目錄乾淨。

- [ ] **Step 3: Push 並確認 GitHub Pages**

```powershell
git push origin main
```

Expected: push 成功；GitHub Pages 的 build、deploy、report-build-status 全部 `success`。

- [ ] **Step 4: 驗證正式網站**

開啟 `https://taitung1110101-boop.github.io/taitung-theft/`，並確認：

```text
https://taitung1110101-boop.github.io/taitung-theft/templates/報損作業自主檢核表.xlsx
```

Expected: 正式網站下載 HTTP 200；Excel 可正常開啟且確認欄空白。
