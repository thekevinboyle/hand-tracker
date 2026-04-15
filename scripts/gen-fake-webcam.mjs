#!/usr/bin/env node
import { execSync } from 'node:child_process';
// Generates a Y4M file that Chromium's --use-file-for-fake-video-capture consumes.
// Y4M is the only reliable format; MP4/H.264 silently fails (see research/playwright-e2e-impl.md).
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../tests/assets/fake-hand.y4m');

mkdirSync(path.dirname(OUT), { recursive: true });

if (existsSync(OUT) && statSync(OUT).size > 0) {
  console.log(`fake webcam file exists: ${OUT}`);
  process.exit(0);
}

// 640x480 30fps, 10s, yuv420p. Uses a moving synthetic pattern — the E2E smoke test
// only needs a stream that plays; hand detection against this is not asserted.
const cmd = [
  'ffmpeg -y -hide_banner -loglevel error',
  '-f lavfi -i "testsrc2=size=640x480:rate=30:duration=10"',
  '-pix_fmt yuv420p',
  '-f yuv4mpegpipe',
  `"${OUT}"`,
].join(' ');

console.log('Generating fake webcam Y4M with ffmpeg...');
try {
  execSync(cmd, { stdio: 'inherit' });
  const sizeMb = (statSync(OUT).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUT} (${sizeMb} MB)`);
} catch (_err) {
  console.error('ffmpeg failed. Is ffmpeg installed? brew install ffmpeg');
  process.exit(1);
}
