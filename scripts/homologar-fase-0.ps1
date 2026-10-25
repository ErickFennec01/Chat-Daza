param(
  [string]$ApiUrl = 'http://127.0.0.1:8100/v1/healthz',
  [switch]$SkipHealth
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked([scriptblock]$Command, [string]$Name) {
  Write-Host "`n== $Name ==" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Name falhou (exit code $LASTEXITCODE)." }
}

Push-Location (Join-Path $repoRoot 'apps/api')
try {
  Invoke-Checked { npm run lint } 'Lint da API'
  Invoke-Checked { npm run build } 'Build da API'
  Invoke-Checked { node --test dist/platform.controller.integration.spec.js dist/platform.service.unit.spec.js dist/waha.service.unit.spec.js } 'Testes da API'
}
finally { Pop-Location }

Push-Location (Join-Path $repoRoot 'apps/web')
try {
  Invoke-Checked { npm run lint } 'Lint do painel'
  Invoke-Checked { npm run build } 'Build do painel'
}
finally { Pop-Location }

Push-Location $repoRoot
try {
  Invoke-Checked { node workflows/tests/validate-fixtures.mjs } 'Fixtures isoladas do workflow'

  if (-not $SkipHealth) {
    Write-Host "`n== Health check local ==" -ForegroundColor Cyan
    $health = Invoke-RestMethod -Uri $ApiUrl -TimeoutSec 10
    if ($health.status -ne 'ok') { throw 'A API não retornou status ok.' }
    Write-Host 'health=ok' -ForegroundColor Green
  }
}
finally { Pop-Location }

Write-Host "`nHomologação automática da Fase 0 concluída." -ForegroundColor Green
