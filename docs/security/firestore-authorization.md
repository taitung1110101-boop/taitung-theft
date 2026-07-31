# Firestore 授權現況與 ARCH-04 邊界

最後確認：2026-08-01

## 已確認現況

- Firebase project：`taitung-cable-theft`
- Firestore database：`(default)`，region `asia-east1`
- 網頁目前只載入 Firebase App 與 Firestore SDK，沒有 Firebase Auth 登入流程。
- 已發布的 `firestore.rules` 對 `reports` collection 使用 `allow read, write: if true;`。
- `EDIT_PIN_HASH` 與 PIN modal 都在瀏覽器端，只能降低介面誤操作，不能限制直接呼叫 Firestore API 的讀寫者。

目前已發布規則：

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{docId} {
      allow read, write: if true;
    }
  }
}
```

## ARCH-04A：資料存取邊界

頁面透過 `ReportRepository` 執行案件資料操作，UI 不再直接組合 Firestore query 或 timestamp：

- `save(draft, status)`
- `list({ status, limit })`
- `get(id)`
- `updateEditableFields(id, changes)`
- `remove(id)`
- `hasRecordsBetween(start, end)`
- `saveNoTheft(report)`

Firestore SDK、server timestamp 與日期轉 timestamp 的細節只存在於 production adapter 建立處與 `report-repository.js`。測試使用記憶體 mock 驗證 interface 與資料 mapping，不連線 production。

## ARCH-04B：正式授權待決策

收緊 Rules 前必須先確認以下 production policy：

1. 哪些 Google 帳號或網域可以讀取案件？
2. 哪些身份可以新增、修改與刪除？是否需要分開角色？
3. 無法登入時是否必須允許填報？若需要，應改走受驗證的 server endpoint，不應繼續讓 collection 公開寫入。
4. 既有紀錄是否包含必須限制存取的個人或案件資訊？

政策確認後的實作順序：

1. 加入 Firebase Auth 與登入／登出狀態。
2. 在測試環境用 Firebase Emulator 驗證允許與拒絕案例。
3. 將 Rules 改為依 `request.auth` 與帳號／角色判定。
4. 先部署 Rules，再部署要求登入的 UI，避免產生權限空窗。
5. 以允許身份、拒絕身份與未登入身份驗證讀／新增／修改／刪除。

在上述政策未確認前，不直接修改或部署 production Rules。
