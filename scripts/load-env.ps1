# scripts/load-env.ps1
# 把项目根目录的 .env.local 加载到当前 PowerShell session
#
# 用法（在项目根目录，注意前面的「点 + 空格」是 dot-source）：
#   . .\scripts\load-env.ps1
#
# 加载后该 session 内所有命令（forge / cast / 任意 cli）都能读到 .env.local 的变量。
# tsx 脚本走 scripts/_env.ts 自动加载，不需要本 helper。

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "[!] Not found: $envFile" -ForegroundColor Red
    return
}

$count = 0
foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $val = $trimmed.Substring($eq + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or
        ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1, $val.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $val
    $count++
}
Write-Host "[OK] Loaded $count vars from .env.local" -ForegroundColor Green
