param([switch]$Force)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $repositoryRoot 'runtime'
$serverPath = Join-Path $runtimePath 'llama-server.exe'
$modelPath = Join-Path $runtimePath 'qwen2.5-0.5b-instruct-q4_k_m.gguf'
$modelUrl = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true'

New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null

if ($Force -or -not (Test-Path -LiteralPath $serverPath)) {
  Write-Host 'Finding the latest official llama.cpp Windows build...'
  $releases = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=20'
  $asset = $releases.assets | Where-Object { $_.name -like 'llama-*-bin-win-cpu-x64.zip' } | Select-Object -First 1
  if (-not $asset) { throw 'No official Windows x64 CPU llama.cpp release was found.' }
  $archivePath = Join-Path $runtimePath 'llama-cpp-download.zip'
  Write-Host "Downloading $($asset.name)..."
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath
  Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimePath -Force
  Remove-Item -LiteralPath $archivePath
} else {
  Write-Host 'llama.cpp is already installed locally.'
}

if ($Force -or -not (Test-Path -LiteralPath $modelPath)) {
  Write-Host 'Downloading Qwen2.5 0.5B Instruct Q4_K_M (about 469 MiB)...'
  Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath
} else {
  Write-Host 'The local Qwen model is already present.'
}

if (-not (Test-Path -LiteralPath $serverPath)) { throw 'llama-server.exe was not installed correctly.' }
if ((Get-Item -LiteralPath $modelPath).Length -lt 400MB) { throw 'The model download appears incomplete.' }

Write-Host ''
Write-Host 'BrainBug is ready. Run: npm start'

