#!/usr/bin/env node
// Self-hosts the MediaPipe model + wasm so the app works behind COEP: require-corp
// without needing CORP headers from any CDN. See research/mediapipe-impl.md.
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MEDIAPIPE_VERSION = '0.10.34';
const JSDELIVR = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

// Exact 6-file wasm manifest confirmed in research/mediapipe-impl.md
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const MODEL_FILE = 'hand_landmarker.task';

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`  skip (cached): ${path.relative(ROOT, dest)}`);
    return;
  }
  process.stdout.write(`  fetch ${path.relative(ROOT, dest)} ... `);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed ${url} -> ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  const sizeMb = (statSync(dest).size / (1024 * 1024)).toFixed(2);
  console.log(`${sizeMb} MB`);
}

async function main() {
  const wasmDir = path.join(ROOT, 'public/wasm');
  const modelDir = path.join(ROOT, 'public/models');
  mkdirSync(wasmDir, { recursive: true });
  mkdirSync(modelDir, { recursive: true });

  console.log(`Fetching MediaPipe assets (tasks-vision ${MEDIAPIPE_VERSION}):`);
  for (const file of WASM_FILES) {
    await download(`${JSDELIVR}/${file}`, path.join(wasmDir, file));
  }
  await download(MODEL_URL, path.join(modelDir, MODEL_FILE));
  console.log('\nDone. Vite will serve /wasm/ and /models/ from public/.');
}

main().catch((err) => {
  console.error('\nfetch-mediapipe-assets failed:', err.message);
  process.exit(1);
});
