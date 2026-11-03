# Local Windows launcher. No database reset, schema rewrite, build or install.
$ErrorActionPreference = 'Stop'
$sourceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$storageRoot = [IO.Path]::GetFullPath((Join-Path $sourceDirectory '..'))
$dataDirectory = Join-Path $sourceDirectory 'data'
$environmentFile = Join-Path $sourceDirectory '.env'
$entryPoint = Join-Path $sourceDirectory 'server\index.ts'
$releaseFile = Join-Path $sourceDirectory 'dist\release-info.json'
if (-not (Test-Path -LiteralPath $releaseFile -PathType Leaf)) { throw 'Build Forma first: npm run build' }
if (-not (Test-Path -LiteralPath $dataDirectory -PathType Container)) { throw 'Existing Forma data directory is missing; refusing to silently create a different account store.' }
if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) { throw 'Private .env is missing; restore it locally before starting.' }
$release = Get-Content -LiteralPath $releaseFile -Raw | ConvertFrom-Json
if ($release.sourceCommit -notmatch '^[a-f0-9]{40}$') { throw 'Invalid build identity.' }
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue)
if ($listeners.Count) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0].OwningProcess)"
  $command = ([string]$process.CommandLine).Replace('\','/').ToLowerInvariant()
  if (-not $command.Contains($entryPoint.Replace('\','/').ToLowerInvariant())) { throw 'Port 3001 is owned by another launch. Inspect it; this script never stops another process.' }
  $pointerFile = Join-Path $storageRoot 'current.json'
  $pidFile = Join-Path $storageRoot 'server.pid'
  if (-not (Test-Path -LiteralPath $pointerFile) -or -not (Test-Path -LiteralPath $pidFile)) { throw 'Cannot confirm the existing launch identity; inspect it before reusing.' }
  $previous = Get-Content -LiteralPath $pointerFile -Raw | ConvertFrom-Json
  if ($previous.sourceCommit -ne $release.sourceCommit -or $previous.runtimeDirectory -ne $sourceDirectory -or $previous.dataDirectory -ne $dataDirectory -or [int](Get-Content -LiteralPath $pidFile -Raw) -ne $listeners[0].OwningProcess) { throw 'Existing launch metadata differs; restart the owned Forma instance before using a new build.' }
  $running = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/release-info.json' -TimeoutSec 5
  if ($running.sourceCommit -ne $release.sourceCommit) { throw 'Running build differs from the current build; inspect before restarting.' }
  Write-Output 'Forma is already running from this source: http://127.0.0.1:3001/'
  exit 0
}
$logDirectory = Join-Path $storageRoot 'logs'
$temporaryDirectory = Join-Path $storageRoot 'cache\tmp'
New-Item -ItemType Directory -Path $logDirectory,$temporaryDirectory -Force | Out-Null
$env:PORT = '3001'
$env:HOST = '127.0.0.1'
$env:FORMA_DATA_DIR = $dataDirectory
$env:TEMP = $temporaryDirectory
$env:TMP = $temporaryDirectory
$env:npm_config_cache = Join-Path $storageRoot 'cache\npm'
$stamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$nodePath = (Get-Command node).Source
$arguments = @("--env-file-if-exists=$environmentFile",'--import','tsx',$entryPoint)
$started = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $sourceDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "server-$stamp.stdout.log") -RedirectStandardError (Join-Path $logDirectory "server-$stamp.stderr.log") -PassThru
$ready = $false
for ($attempt=0; $attempt -lt 20; $attempt++) {
  if ($started.HasExited) { throw 'Forma exited during startup; inspect its private log locally.' }
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/release-info.json' -TimeoutSec 1
    if ($health.sourceCommit -eq $release.sourceCommit) { $ready=$true; break }
  } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw 'Forma readiness not confirmed; inspect this process before retrying.' }
$pointer = [ordered]@{ sourceCommit=$release.sourceCommit; runtimeDirectory=$sourceDirectory; dataDirectory=$dataDirectory; environmentFile=$environmentFile; url='http://127.0.0.1:3001/' }
[IO.File]::WriteAllText((Join-Path $storageRoot 'current.json'), ($pointer | ConvertTo-Json) + [Environment]::NewLine)
Set-Content -LiteralPath (Join-Path $storageRoot 'server.pid') -Value $started.Id -Encoding ascii
Write-Output "Started Forma PID $($started.Id) from $sourceDirectory at http://127.0.0.1:3001/"
