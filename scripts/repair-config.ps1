[CmdletBinding()]
param(
  [string]$PoiDataDirectory = (Join-Path $env:APPDATA 'poi'),
  [switch]$Repair
)
$ErrorActionPreference = 'Stop'
$senkaConfigPath = [System.IO.Path]::GetFullPath((Join-Path $PoiDataDirectory 'config.cson'))
if (-not (Test-Path -LiteralPath $senkaConfigPath -PathType Leaf)) { throw "Config not found: $senkaConfigPath" }
if ($Repair -and (Get-Process -Name poi -ErrorAction SilentlyContinue)) { throw 'Close all poi processes before repairing. No settings were changed.' }
if (-not ('PoiSenkaConfigRepair' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;
public static class PoiSenkaConfigRepair {
  public static Dictionary<string, object> Run(string path, bool apply) {
    path = Path.GetFullPath(path);
    if (!String.Equals(Path.GetFileName(path), "config.cson", StringComparison.OrdinalIgnoreCase)) throw new Exception("Expected config.cson");
    string temp = path + ".senka-repair-" + Guid.NewGuid().ToString("N") + ".tmp";
    long before = new FileInfo(path).Length, index = 0;
    bool finalNewline = true;
    string newline = "\n";
    using (var probe = File.OpenRead(path)) {
      int previous = -1, next;
      for (int i = 0; i < 4096 && (next = probe.ReadByte()) >= 0; i++) {
        if (next == 10) { if (previous == 13) newline = "\r\n"; break; }
        previous = next;
      }
      if (probe.Length > 0) { probe.Seek(-1, SeekOrigin.End); next = probe.ReadByte(); finalNewline = next == 10 || next == 13; }
    }
    bool pluginRoot = false, own = false, found = false;
    var names = new List<KeyValuePair<long, string>>();
    try {
      using (var reader = new StreamReader(path, new UTF8Encoding(false, true)))
      using (var writer = new StreamWriter(temp, false, new UTF8Encoding(false))) {
        writer.NewLine = newline;
        string line;
        while ((line = reader.ReadLine()) != null) {
          if (line.Trim().Length > 0 && line[0] != ' ' && line[0] != '#') pluginRoot = Regex.IsMatch(line, "^['\"]?plugin['\"]?:\\s*$");
          if (pluginRoot && Regex.IsMatch(line, "^  ['\"]?poi-plugin-senka-ledger['\"]?:\\s*$")) own = true;
          else if (own && line.Trim().Length > 0 && line.Length - line.TrimStart(' ').Length <= 2) own = false;
          var match = own ? Regex.Match(line, "^( +)accountNames:\\s*\\[\\s*$") : Match.Empty;
          if (!match.Success) { writer.WriteLine(line); continue; }
          if (found) throw new Exception("Multiple account-name arrays; refusing ambiguous repair");
          found = true;
          string indent = match.Groups[1].Value;
          bool closed = false;
          while ((line = reader.ReadLine()) != null) {
            string value = line.Trim().TrimEnd(',');
            if (value == "]") { closed = true; break; }
            if (value.Length == 0 || value.StartsWith("#")) continue;
            if (value != "null") {
              if (index <= 0 || value.Length < 2 || (value[0] != '\'' && value[0] != '"') || value[value.Length - 1] != value[0]) throw new Exception("Unexpected account-name value; original preserved");
              names.Add(new KeyValuePair<long, string>(index, value));
            }
            index++;
          }
          if (!closed) throw new Exception("Unterminated account-name array; original preserved");
          writer.WriteLine(indent + "accountNames:" + (names.Count == 0 ? " {}" : ""));
          foreach (var name in names) writer.WriteLine(indent + "  '" + name.Key + "': " + name.Value);
        }
        writer.Flush();
        var output = (FileStream)writer.BaseStream;
        if (!finalNewline && output.Length >= newline.Length) output.SetLength(output.Length - newline.Length);
        output.Flush(true);
      }
      long after = new FileInfo(temp).Length;
      var result = new Dictionary<string, object>();
      result["FoundArray"] = found; result["OriginalBytes"] = before; result["RepairedBytes"] = found ? after : before;
      result["RecoveredNames"] = names.Count; result["Repaired"] = false;
      if (found && apply) {
        string backup = path + ".senka-backup-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
        File.Replace(temp, path, backup);
        temp = null;
        result["Repaired"] = true; result["BackupPath"] = backup;
      }
      return result;
    } finally { if (temp != null && File.Exists(temp)) File.Delete(temp); }
  }
}
'@
}
[PoiSenkaConfigRepair]::Run($senkaConfigPath, [bool]$Repair)
