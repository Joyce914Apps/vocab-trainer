# ADR-0002 後端用 Firebase 而非自建 API

日期：2026-09-09　｜　狀態：已採納

## 背景

跨裝置同步與多學生需要後端。選項：Firebase（Auth + Firestore + Functions）、自寫 API（dart_frog / Node 部署到 Cloud Run）、傳統 VPS。

## 決定

用 Firebase。本機 Drift 為真相，Firestore 開離線快取，每張卡以 `updatedAt` 取新者。

## 理由

- 使用量遠低於免費額度（一位學生每天數百次讀寫）
- Firestore SDK 內建離線佇列，省掉自己寫同步佇列
- 開發者在 line_bento_order 已熟悉 Auth、Firestore、Functions，沒有學習成本
- 求職市場對行動開發者的期待是「會接 BaaS 與 REST API」，自建後端不是加分重點

## 代價

- 資料結構被 Firestore 的文件模型限制，複雜查詢要靠本機
- 匿名帳號認領需要一個 Cloud Function
- 若未來要換雲，要重寫 data 層的 remote 實作（domain 不受影響）
