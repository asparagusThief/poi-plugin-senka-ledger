# 战果手账 · Senka Ledger

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

适用于 **poi 12.0.1+** 的本地战果记录插件。

## 功能

- 查看往月记录、每日战果和每小时明细。
- 记录出击、演习、远征的经验战果，汇总 EO 和任务奖励；点击 EO 或任务合计可查看奖励明细。
- 单独查看未在本地记录的经验战果合计及可能发生区间。
- 查看自己与第 **1、5、20、100、500** 名的排名战果、差额和较上次刷新的变化。
- 各账号独立保存历史，记住时区，支持数据备份与恢复。

支持简体中文、繁体中文、英语、日语和韩语，可在 poi 主面板或独立窗口中使用。

## 开始使用

在 poi 插件管理中安装 `poi-plugin-senka-ledger`，或使用 [GitHub Releases](https://github.com/asparagusThief/poi-plugin-senka-ledger/releases) 中的安装包。启用插件后进入母港，开始记录。

选择账号和月份，点击日期查看每小时战果，再点击小时打开明细。明细可用按钮或鼠标滚轮翻页。提督名从母港读取，尚未读取到名字的账号显示编号。

读取排名战果时，在游戏内打开排名列表并查看对应页面。差值比较日本时间每日 **03:00／15:00** 更新的上一期；缺少上期记录时显示 `—`。

## 导入与导出

点击右侧的**数据**按钮：

| 操作 | 用途 |
| --- | --- |
| 导出本月 CSV | 将所选账号、月份的记录交给表格软件查看或分析。 |
| 导出 JSON（全部历史） | 备份所选账号的全部历史，用于恢复数据或迁移电脑。 |
| 读取 JSON | 选择战果手账导出的 JSON 备份，也支持早期版本的备份。 |

读取后按备份中的账号合并记录，重复记录自动跳过，保留已有历史，不同账号分别保存。写入前自动备份该账号的本地日志；文件无效时不修改本地记录。备份及合并后的日志各限 **32 MB、100,000 笔记录**。

## 关于记录

历史从开始记录后积累。普通战果按 `提督经验 × 7 / 10000` 换算，EO 和支持的任务奖励显示在汇总区。支持的任务编号：`854, 888, 893, 872, 284, 845, 903`。

未在本地记录的经验增量保留可能发生区间，不计入登录时间点。跨日、跨月的区间可能在多个视图中出现，不能将这些合计相加。活动汇总不包含官方排名继承和月末调整。

数据保存在 `APPDATA_PATH/senka-ledger/`，不保存 token、密码或完整游戏响应。

## 预览

下图使用模拟数据。

![月度记录](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/month.png)

![小时记录](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/day.png)

![记录明细](https://raw.githubusercontent.com/asparagusThief/poi-plugin-senka-ledger/main/docs/details.png)

MIT 许可证。
