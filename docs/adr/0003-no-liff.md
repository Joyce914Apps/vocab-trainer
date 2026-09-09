# ADR-0003 不做 LIFF 入口

日期：2026-09-09　｜　狀態：已採納

## 背景

使用者天天開 LINE，LIFF 入口對她最方便，且可用 LINE Bot 推「今天該複習 N 個字」。技術上 Flutter Web 可以跑在 LIFF 裡，line_bento_order 已經這樣做。

## 決定

v2 不做 LIFF，也不列入 v3 優先項。入口就是網址與 PWA 加到主畫面。

## 理由

- 作品集角度：LIFF + Flutter Web + Firebase 在 line_bento_order 已完整展示，重做一次沒有新的技術訊號
- 本專案的差異化是排程引擎、教材資料包、語音功能，LIFF 會分散這個焦點
- LINE 內建瀏覽器跑 Flutter Web 比 Chrome 慢，對首次載入是負面

## 何時重新考慮

若出現多位學生與老師端需求，且提醒推播成為關鍵功能，再以「LINE Bot 推播 + 外部瀏覽器開啟」的輕量方式加入，不走 LIFF 登入。
