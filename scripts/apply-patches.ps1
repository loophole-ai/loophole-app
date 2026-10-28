# Creates a clean build/patch tree: upstream code at UPSTREAM-REF + Loophole patches + asset overlay.
#
#   scripts\patches\apply-patches.ps1                       -> D:\Loophole\loophole-build
#   scripts\patches\apply-patches.ps1 -Target D:\somewhere  -> custom location
#
# The tree is a real git repo (cloned locally from this fork, which already contains
# the upstream objects), checked out detached at UPSTREAM-REF, with patches applied
# on top. Nothing is installed and nothing is built.

#Requires -Version 5.1
param(
    [string]$Target,
    [string]$Source,
    [string]$Ref
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path

if (-not $Source)   { $Source = $repoRoot }
if (-not $Target)   { $Target = Join-Path (Split-Path $repoRoot -Parent) "loophole-build" }
if (-not $Ref)      { $Ref = (Get-Content (Join-Path $repoRoot "UPSTREAM-REF") -Raw).Trim() }
if (-not $Ref)      { throw "UPSTREAM-REF file is empty." }

if (Test-Path $Target) { throw "Target already exists: $Target (delete it or pick another -Target)" }

Write-Host "Cloning $Source -> $Target"
git clone --no-checkout $Source $Target
if ($LASTEXITCODE -ne 0) { throw "clone failed" }

# keep executable bits from patches/HEAD, not from the local filesystem
git -C $Target config core.fileMode false

Write-Host "Checking out upstream ref $Ref"
git -C $Target checkout --detach $Ref
if ($LASTEXITCODE -ne 0) { throw "checkout of $Ref failed (is it fetched in the source repo?)" }

# --- apply patches in series order ---------------------------------------------

$series = Get-Content (Join-Path $repoRoot "patches\series") | Where-Object { $_.Trim() }
foreach ($patch in $series) {
    $patchPath = Join-Path $repoRoot "patches\$patch"
    Write-Host "Applying $patch"
    git -C $Target apply --index --whitespace=nowarn $patchPath
    if ($LASTEXITCODE -ne 0) {
        throw "Patch $patch failed to apply against $Ref. Upstream likely changed the touched lines - rebase the patch, then re-export."
    }
}

# --- overlay binary assets -------------------------------------------------------

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
Write-Host "  upstream: $Ref"
Write-Host ("  patches : {0} applied" -f $series.Count)
Write-Host ""
Write-Host "Next steps (run manually, when you choose to):"
Write-Host "  cd $Target"
Write-Host "  bun install        # regenerates bun.lock for the renamed @loophole-ai/* packages"
Write-Host "  then build with the normal opencode build commands"
