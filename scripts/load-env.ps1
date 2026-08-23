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
$lines = @(Get-Content $envFile -Encoding UTF8)
for ($i = 0; $i -lt $lines.Count; $i++) {
    $trimmed = $lines[$i].Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $val = $trimmed.Substring($eq + 1).Trim()

    # P12 C9 (SR-P1-14)：带引号但同行未闭合 = 多行值（如 TURBO_WALLET_JWK 整段 JSON），
    # 续读后续行直到闭合引号；与 Next.js dotenv 的多行语义对齐
    if ($val.Length -ge 1 -and ($val[0] -eq '"' -or $val[0] -eq "'")) {
        $quote = $val[0]
        $closed = ($val.Length -ge 2 -and $val.EndsWith($quote))
        while (-not $closed -and $i + 1 -lt $lines.Count) {
            $i++
            $val += "`n" + $lines[$i]
            $closed = $val.TrimEnd().EndsWith($quote)
        }
        $val = $val.Trim()
        if ($val.Length -ge 2 -and $val.EndsWith($quote)) {
            $val = $val.Substring(1, $val.Length - 2)
        }
    }
    Set-Item -Path "Env:$key" -Value $val
    $count++
}
Write-Host "[OK] Loaded $count vars from .env.local" -ForegroundColor Green
