# 戦果手帳 · Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

**poi 12.0.1+** 向けのローカル戦果記録プラグインです。

## 機能

- 過去の月、日別・時間別の戦果を表示。日付や時間を選ぶと明細を開けます。
- 出撃・演習・遠征で得た通常戦果を `提督経験値 × 7 / 10000` で換算。EO と対応任務の戦果は集計欄に表示します。
- ローカル未記録の経験値戦果は合計と発生可能期間を別に表示し、ログイン当日やその時間へ加算しません。
- 自分と **1・5・20・100・500** 位のランキング戦果、自分との差、前回更新からの増減を表示します。
- 明細はボタンとマウスホイールでページを切り替えられます。表示件数は画面の高さに合わせ、最大 10 件です。
- 時間帯の保存、アカウント欄の提督名表示、CSV 出力、JSON バックアップ、アカウント別保存に対応します。
- 日本語・英語・簡体字中国語・繁体字中国語・韓国語に対応し、メイン画面と別ウィンドウで利用できます。

## 使い方

1. poi のプラグイン管理で `poi-plugin-senka-ledger` をインストールするか、[GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases) の `.tgz` を使用します。
2. 有効化後に母港へ移動し、提督経験値の基準を取得します。
3. アカウント・月・時間帯を選びます。時間帯は次回も保持されます。提督名は母港のデータから取得し、未取得の場合はアカウント ID を表示します。日付を選ぶと時間別表示、時間を選ぶと明細が開きます。

ランキングを記録するには、ゲーム内でランキングの該当ページを開いてください。差分は毎日 **03:00／15:00 JST** に更新される直前のランキングと比較し、前回の記録がない場合は `—` を表示します。プラグインからゲームへの要求は行いません。

## データ

履歴は記録開始時から蓄積され、ローカル報酬は結果応答の受信時刻で記録します。未記録増分は発生可能期間全体の値を保持するため、複数日・複数月にまたがる期間合計は足し合わせられません。活動集計には公式ランキングの引継ぎや月末調整は含みません。

対応する戦果任務：`854, 888, 893, 872, 284, 845, 903`。

起動や設定ファイルに問題がある場合は[設定の復旧手順](https://github.com/asparagusThief/poi-plugin-senka-ledger/blob/main/docs/recovery.md)を参照してください。

ログの保存先は `APPDATA_PATH/senka-ledger/<アカウントID>.jsonl` です。JSON は PC 移行、poi の再インストール、データ破損時の全履歴復元に使えます。復元時はすべての poi を終了し、元ファイルをバックアップしてから、JSON の `journal` の本文をこのフォルダーの `<アカウントID>.jsonl` として保存してください。画面からのインポートは未対応です。日常の閲覧・分析には CSV を使えます。token・パスワード・API 応答全体は保存しません。

## プレビュー

画像はサンプルデータを使用しています。

![月別表示](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![時間別表示](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![明細](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

## 開発

Node.js 20+ が必要です。実行時のライブラリは poi が提供します。

```text
npm run check
npm test
npm run pack:local
```

パッケージは `dist/` に出力されます。`scripts/install-local.ps1` でソースからインストールできます。既存のプラグインは上書きしません。

MIT ライセンス。
