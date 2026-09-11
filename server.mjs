import http from 'node:http';
import { access, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, 'public');
const runtimeRoot = path.join(here, 'runtime');
const llamaExe = process.env.LLAMA_SERVER || path.join(runtimeRoot, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
const modelFile = path.join(runtimeRoot, 'qwen2.5-0.5b-instruct-q4_k_m.gguf');
const port = Number(process.env.PORT || 4173);
const llamaPort = Number(process.env.LLAMA_PORT || 8081);
const modelName = 'Qwen2.5-0.5B-Instruct Q4_K_M';
let llamaProcess = null;

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function localModelReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${llamaPort}/health`, {signal: AbortSignal.timeout(800)});
    return response.ok;
  } catch {
    return false;
  }
}

async function startLocalModel() {
  if (await localModelReady()) return true;
  if (!(await exists(llamaExe)) || !(await exists(modelFile))) return false;
  if (!llamaProcess) {
    llamaProcess = spawn(llamaExe, [
      '-m', modelFile,
      '--host', '127.0.0.1',
      '--port', String(llamaPort),
      '-c', '1536',
      '-np', '1',
      '-ngl', '0',
      '--log-disable'
    ], {cwd: runtimeRoot, windowsHide: true, stdio: 'ignore'});
    llamaProcess.once('exit', () => { llamaProcess = null; });
  }
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await localModelReady()) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error('request too large');
  }
  return JSON.parse(body || '{}');
}

async function answerQuestion(question) {
  if (!(await startLocalModel())) throw new Error('local model is not installed');
  const response = await fetch(`http://127.0.0.1:${llamaPort}/v1/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: 'local',
      messages: [
        {role: 'system', content: 'You are BrainBug, a tiny local factual assistant. Answer in one or two concise sentences. Prefer exact units and numbers. If unsure, say so. Never claim the fly connectome generated the answer.'},
        {role: 'user', content: String(question).slice(0, 600)}
      ],
      max_tokens: 160,
      temperature: 0.2,
      stream: false
    })
  });
  if (!response.ok) throw new Error(`local model HTTP ${response.status}`);
  const payload = await response.json();
  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('local model returned no answer');
  return {answer, model: modelName, local: true};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(body);
}

function mimeType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/model-status') {
      const installed = await exists(llamaExe) && await exists(modelFile);
      const ready = installed && await startLocalModel();
      return sendJson(res, 200, {installed, ready, model: modelName, local: true});
    }
    if (req.method === 'POST' && req.url === '/api/ask') {
      const {question} = await readBody(req);
      return sendJson(res, 200, await answerQuestion(question || 'What is the speed of light?'));
    }
    const rawPath = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    const requested = rawPath === '/' ? '/index.html' : rawPath;
    const file = path.resolve(siteRoot, `.${requested}`);
    if (!file.startsWith(siteRoot)) return sendJson(res, 403, {error: 'nope'});
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {'Content-Type': mimeType(file)});
    createReadStream(file).pipe(res);
  } catch (error) {
    if (req.url === '/api/ask') return sendJson(res, 502, {error: 'The tiny local model is taking a nap.'});
    sendJson(res, 404, {error: 'not found'});
  }
});

function shutdown() {
  if (llamaProcess && !llamaProcess.killed) llamaProcess.kill();
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(port, async () => {
  console.log(`BrainBug is ready at http://localhost:${port}`);
  if (await startLocalModel()) console.log(`Local model ready: ${modelName}`);
  else console.log('Local model runtime is not installed yet; browser fallback remains available.');
});
