$script:adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$script:ev = "C:\Projects\To-Do App\docs\evidence\app-sprint1"

function Dump {
  & $adb shell uiautomator dump /sdcard/u.xml 2>&1 | Out-Null
  & $adb pull /sdcard/u.xml "$env:TEMP\u.xml" 2>&1 | Out-Null
  [xml](Get-Content "$env:TEMP\u.xml" -Encoding UTF8)
}
function Find-Node($pattern) {
  $x = Dump
  $x.SelectNodes("//node") | Where-Object { ($_.text -match $pattern) -or ($_.'content-desc' -match $pattern) } | Select-Object -First 1
}
function Center($node) {
  if ($node.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') { return @([int](([int]$Matches[1] + [int]$Matches[3]) / 2), [int](([int]$Matches[2] + [int]$Matches[4]) / 2)) }
}
function Tap-Text($pattern) {
  $n = Find-Node $pattern
  if (-not $n) { Write-Output "NOT FOUND: $pattern"; return $false }
  $c = Center $n; & $adb shell input tap $c[0] $c[1]; Start-Sleep -Milliseconds 900; return $true
}
function Type-Into($pattern, $text) {
  # Taps a field (matched by text/hint/content-desc) then types; spaces must be %s for adb.
  if (Tap-Text $pattern) { Start-Sleep -Milliseconds 400; & $adb shell input text ($text -replace ' ', '%s'); Start-Sleep -Milliseconds 400 }
}
function Snap($name) {
  & $adb shell screencap -p /sdcard/s.png 2>&1 | Out-Null
  & $adb pull /sdcard/s.png "$ev\$name.png" 2>&1 | Out-Null
}
function Texts() {
  $x = Dump
  $x.SelectNodes("//node") | Where-Object { $_.text -or $_.'content-desc' } | ForEach-Object { "{0} | {1} | {2} | {3}" -f ($_.class -replace 'android\.\w+\.', ''), $_.text, $_.'content-desc', $_.bounds }
}
