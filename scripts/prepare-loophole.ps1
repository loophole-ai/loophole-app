# Windows version of prepare-loophole.sh: clones upstream opencode at the pinned commit,
# applies the Loophole patch stack, and overlays binary assets.
#
#   scripts\prepare-loophole.ps1                          -> D:\Loophole\loophole-build
#   scripts\prepare-loothole.ps1 -Target <dir>            -> custom location
#
# Nothing is installed and nothing is built here. After this:
#   cd <target>; bun install   (regenerates bun.lock for the @loophole-ai/* packages)

#Requires -Version 5.1
param(
    [string]$Target,
    [string]$UpstreamUrl = "https://github.com/anomalyco/opencode.git",
    [string]$Source,
    [string]$Commit
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path

if (-not $Commit) {
    $pin = Get-Content (Join-Path $repoRoot "upstream\opencode.json") -Raw | ConvertFrom-Json
    $Commit = $pin.commit
}
if (-not $Commit) { throw "upstream/opencode.json has no commit" }
if (-not $Target) { $Target = Join-Path (Split-Path $repoRoot -Parent) "loophole-build" }
if (Test-Path $Target) { throw "Target already exists: $Target (delete it or pick another -Target)" }

Write-Host "Cloning $(if ($Source) { $Source } else { $UpstreamUrl }) -> $Target"
$cloneFrom = if ($Source) { $Source } else { $UpstreamUrl }
git clone --no-checkout $(if ($Source) { "--filter=blob:none" }) $cloneFrom $Target
if ($LASTEXITCODE -ne 0) { throw "clone failed" }

Write-Host "Checking out upstream commit $Commit"
git -C $Target checkout --detach $Commit
if ($LASTEXITCODE -ne 0) { throw "checkout failed" }
git -C $Target config core.fileMode false

foreach ($patch in (Get-Content (Join-Path $repoRoot "patches\series") | Where-Object { $_.Trim() })) {
    Write-Host "Applying $patch"
    git -C $Target apply --index --whitespace=nowarn (Join-Path $repoRoot "patches\$patch")
    if ($LASTEXITCODE -ne 0) {
        throw "Patch $patch failed against $Commit - upstream changed the touched lines. Fix the patch, then commit."
    }
}

$assetsDir = Join-Path $repoRoot "assets"
if (Test-Path $assetsDir) {
    Write-Host "Copying binary assets overlay"
    Get-ChildItem $assetsDir -Recurse -File | Where-Object { $_.Name -ne "deletes.txt" } | ForEach-Object {
        $rel = $_.FullName.Substring($assetsDir.Length).TrimStart("\")
        $dst = Join-Path $Target $rel
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        Copy-Item $_.FullName $dst -Force
    }
}

$deletesPath = Join-Path $assetsDir "deletes.txt"
if (Test-Path $deletesPath) {
    foreach ($rel in (Get-Content $deletesPath | Where-Object { $_.Trim() })) {
        $f = Join-Path $Target ($rel -replace "/", "\")
        if (Test-Path $f) { Remove-Item $f -Force }
    }
}

Write-Host ""
Write-Host "Patch tree ready: $Target"
Write-Host "  upstream: $Commit"
Write-Host ""
Write-Host "Next (run when you choose to):"
Write-Host "  cd $Target"
Write-Host "  bun install     # regenerate bun.lock for the @loophole-ai/* packages"
Write-Host "  then the normal opencode build commands"
