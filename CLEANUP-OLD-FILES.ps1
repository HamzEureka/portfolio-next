# شغّله مرة واحدة من داخل مجلد المشروع بعد فك الـ zip فوق v7
# يحذف الملفات القديمة التي لم تعد مستخدمة (القائمة في DELETIONS.txt)
Get-Content .\DELETIONS.txt | Where-Object { $_.Trim() } | ForEach-Object {
  $p = $_.Trim()
  if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "deleted $p" }
}
