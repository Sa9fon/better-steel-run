# Regenerates every store image in this folder (Windows, needs Microsoft Edge).
# Run from anywhere: powershell -ExecutionPolicy Bypass -File store\render.ps1
$store = $PSScriptRoot
$root = Split-Path $store
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$profile = Join-Path $env:TEMP 'bsr-store-render'
$toUrl = { param($path) 'file:///' + ($path -replace '\\', '/' -replace ' ', '%20') }

function Shoot($url, $w, $h, $scale, $out) {
  $null = Start-Process -FilePath $edge -Wait -PassThru -ArgumentList @(
    '--headless', '--disable-gpu', '--hide-scrollbars', "--force-device-scale-factor=$scale", "--window-size=$w,$h",
    '--virtual-time-budget=3000', "`"--user-data-dir=$profile`"", "`"--screenshot=$out`"", "`"$url`"")
}

# 1. The popup as store users see it: no bundled songs, "Custom Local File" selected.
$popup = (Get-Content "$root\popup.html" -Raw -Encoding UTF8).Replace('<script src="popup.js"></script>', '')
$popup = $popup -replace '(?s)<option value="sounds/horse.mp3">.*?</option>\s*<option value="sounds/chain.mp3">.*?</option>\s*', ''
$popup = $popup.Replace('<option value="custom">', '<option value="custom" selected>').Replace('<label id="fileRow" hidden>', '<label id="fileRow">').Replace(
  '<span class="hint" id="fileHint"></span>', '<span class="hint" id="fileHint">A song is saved. Pick another file to replace it.</span>')
$share = $popup.Replace('<div id="confirm" hidden>', '<div id="confirm">').Replace(
  '<p id="confirmText"></p>', '<p id="confirmText">Share ending 21:40 &rarr; 23:10 for episode 2 on AniSkip? It will be public.</p>').Replace(
  '<div id="status" role="status"></div>', '<div id="status" class="ok" role="status">Saved for this show: 110s before the end.</div>')
$tmp = Join-Path $root '_render.html'  # next to popup.html so fonts/ resolves
foreach ($s in @(@('popup-store', $popup, 588), @('share-store', $share, 780))) {
  [IO.File]::WriteAllText($tmp, $s[1], (New-Object System.Text.UTF8Encoding $false))
  Shoot (& $toUrl $tmp) 300 $s[2] 2 "$store\$($s[0]).png"
}
Remove-Item $tmp

# 2. Screenshots, promo tile and marquee from template.html (the tile renders at 2x: headless won't go below ~500px wide).
$tpl = & $toUrl "$store\template.html"
foreach ($j in @(
    @('shot1', 1280, 800, 1, 'chrome-screenshot-1.png'), @('shot2', 1280, 800, 1, 'chrome-screenshot-2.png'),
    @('shot3', 1280, 800, 1, 'chrome-screenshot-3.png'), @('tile', 880, 560, 0.5, 'promo-tile-440x280.png'),
    @('marquee', 1400, 560, 1, 'marquee-1400x560.png'),
    @('shot1', 1224, 816, 0.5, 'opera-screenshot-1.png'), @('shot2', 1224, 816, 0.5, 'opera-screenshot-2.png'))) {
  Shoot "$tpl#$($j[0])" $j[1] $j[2] $j[3] "$store\$($j[4])"
}
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue

# 3. 300x300 logo, drawn like the toolbar icons (transparent background, exact pixels).
Add-Type -AssemblyName System.Drawing
$size = 300; $s = $size / 44.0
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.Clear([System.Drawing.Color]::Transparent)
$outline = [System.Drawing.Color]::FromArgb(58, 21, 82)
$rect = New-Object System.Drawing.RectangleF (2 * $s), (2 * $s), (40 * $s), (40 * $s)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath; $path.AddEllipse($rect)
$brush = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
$brush.CenterPoint = New-Object System.Drawing.PointF (15 * $s), (13 * $s)
$brush.CenterColor = [System.Drawing.Color]::FromArgb(255, 251, 232); $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(176, 118, 18))
$g.FillEllipse($brush, $rect); $g.DrawEllipse((New-Object System.Drawing.Pen $outline, (2 * $s)), $rect)
$pen = New-Object System.Drawing.Pen $outline, (1.8 * $s); $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
foreach ($a in @(@(24, 2, 180), @(22, 4, 0), @(24, 6, 180), @(22, 8, 0), @(24, 10, 180))) {
  $cx = $a[0] * $s; $r = $a[1] * $s
  $g.DrawArc($pen, [float]($cx - $r), [float](22 * $s - $r), [float](2 * $r), [float](2 * $r), [float]$a[2], [float]180)
}
$bmp.Save("$store\logo-300x300.png", [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()

Get-ChildItem "$store\*.png" | ForEach-Object {
  $i = [System.Drawing.Image]::FromFile($_.FullName); '{0,-26} {1}x{2}' -f $_.Name, $i.Width, $i.Height; $i.Dispose()
}
