# Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

A local senka history plugin for **poi 12.0.1+**.

## Features

- Browse monthly history, daily values and hourly details.
- Track sortie, practice and expedition EXP, with EO and quest rewards in the summary.
- View unrecorded EXP gains separately, with totals and possible time intervals.
- Compare your ranking score with ranks **1, 5, 20, 100 and 500**, and with the previous ranking refresh.
- Keep separate account histories, save your time zone, and back up or restore records.

Available in English, Simplified Chinese, Traditional Chinese, Japanese and Korean. Supports poi's main panel and separate windows.

## Getting started

Install `poi-plugin-senka-ledger` in poi's plugin manager, or use a package from [GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases). Enable the plugin and enter the home port to start recording.

Choose an account and month. Click a date for hourly values, then an hour for details. Use the buttons or mouse wheel to change detail pages. Admiral names are read from the home port; accounts without a known name display their ID.

To capture ranking scores, open the in-game ranking list and visit the relevant pages. Changes compare the preceding **03:00 / 15:00 JST** refresh. Missing previous scores show `—`.

## Import and export

Open **Data** on the right:

| Action | Purpose |
| --- | --- |
| Export month CSV | View or analyze the selected account's records for the selected month in a spreadsheet. |
| Export JSON (all history) | Back up all history for the selected account, for recovery or moving computers. |
| Import JSON | Select a JSON backup exported by Senka Ledger, including backups from earlier versions. |

Import merges records into the account identified by the backup, skips duplicates and preserves local history. Other accounts remain separate. The existing journal is backed up before changes. Invalid files leave local records unchanged. The backup and merged journal must each fit within **32 MB / 100,000 records**.

## About the records

History starts when recording begins. Normal senka is calculated as `Admiral EXP × 7 / 10000`; EO and supported quests appear in the summary. Supported quest IDs: `854, 888, 893, 872, 284, 845, 903`.

Unrecorded EXP gains retain their possible time intervals instead of being assigned to the login time. Intervals spanning days or months can appear in several views; do not add those totals together. Activity totals exclude official ranking carryover and month-end adjustments.

Records are stored in `APPDATA_PATH/senka-ledger/`. Tokens, passwords and complete API responses are not saved.

## Preview

Sample data.

![Monthly history](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![Hourly details](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![Record details](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

MIT license.
