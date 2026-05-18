$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$root = $PSScriptRoot

Set-Location $root

if (-not (Test-Path $gh)) {
    Write-Host "GitHub CLI not found. Install: winget install GitHub.cli"
    exit 1
}

# Remove placeholder remote if present
$remote = git remote get-url origin 2>$null
if ($remote -match "YOUR_USERNAME") {
    git remote remove origin
}

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Opening GitHub sign-in in your browser..."
    Start-Process "https://github.com/login/device"
    & $gh auth login --hostname github.com --git-protocol https --web
}

if (git remote get-url origin 2>$null) {
    Write-Host "Remote 'origin' already set. Pushing..."
    git push -u origin main
} else {
    & $gh repo create work-planner --public --source=. --remote=origin --push `
        --description "WorkHub - teacher planner with student management"
}

Write-Host "Done. Repo:" (& $gh repo view --json url -q .url)
