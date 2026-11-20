# final-gate.ps1 - run from the project root: powershell -ExecutionPolicy Bypass -File scripts\final-gate.ps1
# Runs the whole automated gate once and writes final-gate-report.txt. Changes nothing except node_modules/.next.
# Use -SkipInstall to skip "npm ci".
param([switch]$SkipInstall)
$ErrorActionPreference = 'Continue'
$report = Join-Path (Get-Location) 'final-gate-report.txt'
"FINAL GATE  $(Get-Date -Format s)" | Out-File -FilePath $report -Encoding utf8
$rows = @()
function Step([string]$Name, [string]$Kind, [scriptblock]$Cmd) {
  # Kind: GATE = failure blocks release; REVIEW = non-zero means "owner must read the output"
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  "`n=== $Name ===" | Out-File -FilePath $report -Append -Encoding utf8
  $global:LASTEXITCODE = 0
  $out = & $Cmd 2>&1 | Out-String
  $code = $global:LASTEXITCODE
  $out | Out-File -FilePath $report -Append -Encoding utf8
  ($out -split "`r?`n" | Select-Object -Last 12) | ForEach-Object { Write-Host $_ }
  $status = if ($code -eq 0) { 'PASS' } elseif ($Kind -eq 'GATE') { 'FAIL' } else { 'REVIEW' }
  $script:rows += [pscustomobject]@{ Step = $Name; Status = $status; Exit = $code }
}
if (-not $SkipInstall) { Step 'npm ci' 'GATE' { npm ci } }
Step 'npm test'            'GATE' { npm test }
Step 'npm run typecheck'   'GATE' { npm run typecheck }
Step 'npm run verify:css'  'GATE' { npm run verify:css }
Step 'npm run build'       'GATE' { npm run build }
foreach ($a in 'audit_keys','audit_colors','audit_i18n','audit_rtl','audit_theme') {
  if (Test-Path "scripts\$a.ts") { Step "npx tsx scripts\$a.ts" 'REVIEW' { npx tsx "scripts\$a.ts" } }
}
Step 'git status --short' 'REVIEW' { git status --short }
Write-Host "`n=========== SUMMARY ===========" -ForegroundColor Yellow
$rows | Format-Table -AutoSize | Out-String | Tee-Object -FilePath $report -Append | Write-Host
$fails = @($rows | Where-Object { $_.Status -eq 'FAIL' }).Count
if ($fails -eq 0) { Write-Host 'GATE: PASS (now do the browser checklist)' -ForegroundColor Green } else { Write-Host "GATE: FAIL ($fails step(s)) - send final-gate-report.txt to Claude" -ForegroundColor Red }
Write-Host "Report: $report"
