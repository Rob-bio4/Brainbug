#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$repo_root/runtime"
model_path="$runtime_dir/qwen2.5-0.5b-instruct-q4_k_m.gguf"
mkdir -p "$runtime_dir"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) pattern='bin-macos-arm64.tar.gz' ;;
  Darwin-x86_64) pattern='bin-macos-x64.tar.gz' ;;
  Linux-x86_64) pattern='bin-ubuntu-x64.tar.gz' ;;
  Linux-aarch64|Linux-arm64) pattern='bin-ubuntu-arm64.tar.gz' ;;
  *) echo 'Unsupported platform. Install llama.cpp manually and set LLAMA_SERVER.'; exit 1 ;;
esac

if [[ ! -x "$runtime_dir/llama-server" ]]; then
  echo 'Finding the latest official llama.cpp build...'
  asset_url="$(node -e "fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=20').then(r=>r.json()).then(rs=>{const a=rs.flatMap(r=>r.assets).find(a=>a.name.endsWith(process.argv[1]));if(!a)process.exit(2);process.stdout.write(a.browser_download_url)})" "$pattern")"
  curl --fail --location "$asset_url" --output "$runtime_dir/llama-cpp.tar.gz"
  tar -xzf "$runtime_dir/llama-cpp.tar.gz" -C "$runtime_dir"
  rm "$runtime_dir/llama-cpp.tar.gz"
  chmod +x "$runtime_dir/llama-server"
fi

if [[ ! -f "$model_path" ]]; then
  echo 'Downloading Qwen2.5 0.5B Instruct Q4_K_M (about 469 MiB)...'
  curl --fail --location 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true' --output "$model_path"
fi

echo 'BrainBug is ready. Run: npm start'

