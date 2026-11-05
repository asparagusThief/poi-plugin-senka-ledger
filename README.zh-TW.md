# 戰果手帳 · Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

適用於 **poi 12.0.1+** 的本機戰果記錄插件。

## 功能

- 查看往月、每日與每小時戰果，點選日期或小時開啟明細。
- 記錄本機出擊、演習、遠征的一般戰果，按 `提督經驗 × 7 / 10000` 換算。EO 與支援的任務戰果顯示於彙總區。
- 未記錄的經驗戰果另列合計與可能發生區間，不計入登入當天或該小時。
- 查看自己及第 **1、5、20、100、500** 名的排名戰果、與自己的差額及較上期的變化。
- 分頁明細、CSV 匯出、JSON 備份，各帳號獨立儲存。
- 支援繁體中文、簡體中文、英語、日語、韓語，適用於主面板及獨立視窗。

## 使用

1. 在 poi 插件管理安裝 `poi-plugin-senka-ledger`，或從 [GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases) 下載 `.tgz`。
2. 啟用後進入母港，建立提督經驗基準。
3. 選擇帳號、月份與時區。點選日期查看每小時戰果，再點小時開啟明細。

排名資料須在遊戲內開啟排名列表並查看相應頁面。差值比較日本時間每日 **03:00／15:00** 更新的緊鄰上一期；缺少上期記錄時顯示 `—`。插件不主動發送遊戲請求。

## 資料

歷史從開始記錄後累積，本機獎勵依結算回應的接收時間記帳。未記錄增量保留完整的可能發生區間，跨日、跨月的區間合計不能相加。活動彙總不計算官方排名繼承與月末調整。

支援的戰果任務：`854, 888, 893, 872, 284, 845, 903`。

日誌位於 `APPDATA_PATH/senka-ledger/<帳號ID>.jsonl`。還原前備份該資料夾，關閉所有 poi 後再替換日誌。JSON 備份的 `journal` 欄位包含原始日誌文字，目前沒有介面匯入功能。不儲存 token、密碼或完整 API 回應。

## 預覽

下圖使用模擬資料。

![月度記錄](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![小時記錄](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![明細視窗](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

## 開發

需要 Node.js 20+，執行依賴由 poi 提供。

```text
npm run check
npm test
npm run pack:local
```

安裝包產生於 `dist/`。`scripts/install-local.ps1` 可從原始碼安裝，不覆寫已有插件。

MIT 授權。
