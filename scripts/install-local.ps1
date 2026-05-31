param(
  [switch]$BuildLocal,
  [string]$EnvFile = ".env.docker",
  [switch]$WithBackup,
  [switch]$NoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Krav saknas: '$Name' finns inte i PATH."
  }
}

function Invoke-DockerCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Misslyckades: $Description (exitkod $LASTEXITCODE)."
  }
}

try {
  Require-Command "docker"

  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location $repoRoot

  if (-not (Test-Path $EnvFile)) {
    if (-not (Test-Path ".env.docker.example")) {
      throw "Hittade varken $EnvFile eller .env.docker.example."
    }

    Copy-Item ".env.docker.example" $EnvFile
    Write-Host "Skapade $EnvFile från .env.docker.example."
    Write-Host "Uppdatera hemligheter i $EnvFile innan installationen fortsätter."
    Write-Host "Tips: JWT_SECRET ska vara en lång slumpmässig sträng."
    exit 1
  }

  Invoke-DockerCommand -Description "docker info" -Command { docker info | Out-Null }

  $composeArgs = @("-f", "docker-compose.yml")
  if (-not $BuildLocal) {
    $composeArgs += @("-f", "docker-compose.prod.yml")
  }

  $profileArgs = @()
  if ($WithBackup) {
    $profileArgs += @("--profile", "backup")
  }

  if ($NoStart) {
    Invoke-DockerCommand -Description "docker compose config" -Command {
      docker compose @profileArgs @composeArgs --env-file $EnvFile config | Out-Null
    }
    Write-Host "Compose-konfiguration validerad."
    exit 0
  }

  Invoke-DockerCommand -Description "docker compose up" -Command {
    docker compose @profileArgs @composeArgs --env-file $EnvFile up -d
  }

  Write-Host "Installation klar."
  Write-Host "Web: http://localhost:5173"
  Write-Host "API health: http://localhost:3000/health"
  $statusCommand = "docker compose " + (($profileArgs + $composeArgs) -join " ") + " --env-file $EnvFile ps"
  Write-Host "Status: $statusCommand"
}
catch {
  Write-Error $_
  exit 1
}
