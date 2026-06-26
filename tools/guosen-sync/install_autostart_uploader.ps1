$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDir "config.json"
$RunnerPath = Join-Path $ScriptDir "run_snapshot_uploader_hidden.vbs"
$StartupDir = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupDir "NanStar Wealth Guosen Uploader.lnk"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "config.json is missing. Run setup_local_sync.bat first."
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$RunnerPath`""
$shortcut.WorkingDirectory = $ScriptDir
$shortcut.WindowStyle = 7
$shortcut.Description = "NanStar Wealth Guosen snapshot uploader"
$shortcut.Save()

Write-Host "Installed startup shortcut:"
Write-Host "  $ShortcutPath"
Write-Host ""
Write-Host "It will start after Windows login. To start it now, double-click:"
Write-Host "  $RunnerPath"
Write-Host ""
Write-Host "Logs:"
Write-Host "  $(Join-Path $ScriptDir 'local_snapshot_uploader.log')"
