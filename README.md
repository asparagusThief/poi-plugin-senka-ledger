# Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

A local senka ledger for **poi 12.0.1+**.

## Features

- Monthly history with daily and hourly senka values; click a date or hour to view details.
- Local sortie, practice and expedition rewards, calculated as `Admiral EXP × 7 / 10000`. EO and supported quest rewards appear in the summaries.
- Unrecorded EXP gains shown separately with a total and possible time intervals, without assigning them to the login day or hour.
- Ranking snapshots for yourself and positions **1, 5, 20, 100 and 500**, including gaps and changes since the preceding refresh.
- Details with previous/next buttons and mouse-wheel paging. Each page fits the window, up to 10 records.
- Remembered time zone, Admiral names in the account list, CSV export, JSON backup and separate journals for each account.
- English, Simplified Chinese, Traditional Chinese, Japanese and Korean; works in the main panel and separate windows.

## Use

1. Install `poi-plugin-senka-ledger` through poi's plugin manager or download the `.tgz` from [GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases).
2. Enable the plugin and enter the home port to establish the EXP baseline.
3. Select an account, month and time zone. The time zone is saved for future sessions. Account names are learned from home-port data; unread names use the account ID. Click a date for hourly values, then an hour for details.

Open the ranking list in the game and visit the relevant pages to record ranking scores. Changes compare the immediately preceding **03:00 / 15:00 JST** refresh; missing prior records show `—`. The plugin does not make game requests.

## Data

History starts when recording begins. Local rewards use their observed result time. Unrecorded gains retain their complete possible intervals; overlapping daily or monthly interval totals must not be added together. Activity totals do not include ranking carryover or official month-end adjustments.

Supported senka quests: `854, 888, 893, 872, 284, 845, 903`.

Journals are stored in `APPDATA_PATH/senka-ledger/<accountID>.jsonl`. JSON backs up the full history for moving computers, reinstalling poi or recovering damaged data. To restore, close all poi instances and save the backup's `journal` text as `<accountID>.jsonl` in this folder, after backing up the existing file. There is no in-app import. CSV is intended for viewing and analysis. Tokens, passwords and complete API responses are not stored.

## Preview

Screenshots use sample data.

![Monthly view](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![Hourly view](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![Detail dialog](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

## Development

Node.js 20+. Runtime libraries are provided by poi.

```text
npm run check
npm test
npm run pack:local
```

Packages are generated in `dist/`. `scripts/install-local.ps1` installs from source without overwriting an existing plugin.

MIT license.
