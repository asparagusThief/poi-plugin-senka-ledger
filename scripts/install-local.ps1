[CmdletBinding()]
param([string]$PoiDataDirectory = (Join-Path $env:APPDATA 'poi'))
$ErrorActionPreference = 'Stop'
$sourceDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$poiDirectory = [System.IO.Path]::GetFullPath($PoiDataDirectory)
$pluginParent = [System.IO.Path]::GetFullPath((Join-Path $poiDirectory 'plugins-extra\node_modules'))
$destination = [System.IO.Path]::GetFullPath((Join-Path $pluginParent 'poi-plugin-senka-ledger'))
if ($destination -ne ($pluginParent.TrimEnd('\') + '\poi-plugin-senka-ledger')) { throw 'Unexpected destination.' }
if (-not (Test-Path -LiteralPath $poiDirectory -PathType Container)) { throw "poi data directory does not exist: $poiDirectory" }
if (Test-Path -LiteralPath $destination) { throw "Plugin already exists; nothing overwritten: $destination" }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach ($name in @('package.json', 'index.js', 'src', 'assets', 'i18n', 'README.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.ja-JP.md', 'README.ko-KR.md', 'LICENSE')) {
    Copy-Item -LiteralPath (Join-Path $sourceDirectory $name) -Destination $destination -Recurse
}
Write-Output "Installed: $destination"
Write-Output 'Restart poi and enable Senka Ledger / 战果手账.'
