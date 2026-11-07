# Recovering a swollen poi configuration

Version 0.2.6 has a defect in saving Admiral names: numeric account IDs can become array indexes in poi's configuration. This can greatly enlarge `config.cson`, freeze the interface, and prevent startup. Version 0.2.7 fixes the write operation. Updating the plugin alone does not shrink an already affected configuration.

1. Close poi, including any windowless `poi.exe` processes left by failed startup attempts.
2. Download [repair-config.ps1](../scripts/repair-config.ps1), or use the copy in this repository.
3. Check the file without changing it:

   ```powershell
   .\repair-config.ps1
   ```

4. If `FoundArray` is `True`, repair it:

   ```powershell
   .\repair-config.ps1 -Repair
   ```

For a custom data directory, add `-PoiDataDirectory 'D:\your-poi-data'`. The script changes only Senka Ledger's malformed account-name field, preserves the other settings, and creates a complete `config.cson.senka-backup-*` backup before replacement. It does not modify the `senka-ledger` journals. `FoundArray: False` means no repair was needed.

Start poi and use version 0.2.7 or newer. Do not re-enable version 0.2.6.

## 中文

v0.2.6 保存提督名时可能把数字账号当作数组下标，使 `config.cson` 异常增大，造成卡顿或无法启动。v0.2.7 已修正写入方式，但已膨胀的配置需要单独修复。

关闭 poi 及启动失败后残留的 `poi.exe` 进程，下载上面的修复脚本。先运行 `./repair-config.ps1` 检查；若 `FoundArray` 为 `True`，再运行 `./repair-config.ps1 -Repair` 修复。自定义数据目录可加 `-PoiDataDirectory '你的数据目录'`。

脚本只修复战果手账的账号名称字段，保留其他设置，并在替换前完整备份原配置。战果日志不受影响。之后启动 poi 并使用 v0.2.7 或更新版本，避免再次启用 v0.2.6。
