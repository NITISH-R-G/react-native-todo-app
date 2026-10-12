$script:adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$script:ev = "C:\Projects\To-Do App\docs\evidence\app-sprint3"

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

# ---- TalkBack focus-ring locator (TalkBack draws a green rectangle, about #6BC243, around the focused element)
if (-not ('RingFinder2' -as [type])) {
Add-Type -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class RingFinder2 {
  public static int[] Find(string path, int tol) {
    using (var bmp = new Bitmap(path)) {
      var d = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
      int minX=int.MaxValue,minY=int.MaxValue,maxX=-1,maxY=-1,count=0; byte[] row = new byte[d.Stride];
      for (int y=0;y<bmp.Height;y++){ Marshal.Copy(IntPtr.Add(d.Scan0,y*d.Stride),row,0,d.Stride);
        for (int x=0;x<bmp.Width;x++){ int b=row[x*3],g=row[x*3+1],r=row[x*3+2];
          if (Math.Abs(r-107)<=tol && Math.Abs(g-194)<=tol && Math.Abs(b-67)<=tol){ count++; if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; } } }
      bmp.UnlockBits(d); return count>150 ? new int[]{minX,minY,maxX,maxY,count} : null; } } }
"@ -ReferencedAssemblies System.Drawing
}
function Snap-Ring($name){ Snap $name; [RingFinder2]::Find("$ev\$name.png",18) }
function Match-Node($ring){
  if(-not $ring){ return "(no ring)" }
  $x=Dump; $best=$null; $bd=1e9
  foreach($nd in $x.SelectNodes("//node")){ if($nd.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]'){
      $d=[math]::Abs([int]$Matches[1]-$ring[0])+[math]::Abs([int]$Matches[2]-$ring[1])+[math]::Abs([int]$Matches[3]-$ring[2])+[math]::Abs([int]$Matches[4]-$ring[3])
      if($d -lt $bd -and ($nd.'content-desc' -or $nd.text)){ $bd=$d; $best=$nd } } }
  if($best){ $l=if($best.'content-desc'){$best.'content-desc'}else{$best.text}; "{0} [{1}]{2}{3} (bounds off by {4}px)" -f $l,($best.class -replace 'android\.\w+\.',''),$(if($best.checkable -eq 'true'){" checkable"}else{""}),$(if($best.checked -eq 'true'){" checked"}else{""}),$bd } else { "(unmatched ring " + ($ring -join ",") + ")" }
}
# One TalkBack "next item" gesture (quick swipe right) followed by a read of the focused element.
function TB-Walk($steps){ $t=@(); for($i=0;$i -lt $steps;$i++){ $t += ("{0,2}. {1}" -f ($i+1),(Match-Node (Snap-Ring "tb_step"))); & $adb shell input swipe 300 1500 800 1500 80; Start-Sleep -Milliseconds 1300 }; $t }
