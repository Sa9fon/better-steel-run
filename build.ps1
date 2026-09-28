# Builds dist/better-steel-run-<version>.zip: the upload for every store (Chrome, Edge, Opera, Firefox).
# Uses Windows' own tar.exe because it writes forward-slash zip paths (Firefox rejects backslashes,
# which PowerShell's Compress-Archive writes). Songs and docs are left out.
$root = $PSScriptRoot
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$zip = "$root\dist\better-steel-run-$version.zip"
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
Remove-Item $zip -ErrorAction SilentlyContinue
Push-Location $root
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip manifest.json content.js popup.html popup.js icons fonts
Pop-Location
"Built $zip"
