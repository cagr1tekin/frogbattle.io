import { createCanvas } from 'canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'client', 'assets', 'sprites');
const outFile = path.join(outDir, 'frog-default.png');
const outDead = path.join(outDir, 'frog-dead.png');

const size = 64;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

ctx.clearRect(0, 0, size, size);
const cx = size / 2;
const cy = size / 2;
const r = 26;
ctx.beginPath();
ctx.arc(cx, cy, r, 0, Math.PI * 2);
ctx.fillStyle = '#2d7a3e';
ctx.fill();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, canvas.toBuffer('image/png'));
console.log('Yazıldı:', outFile);

/* Ölü kurbağa — koyu gri, yatay çizgi (sprite yönü yukarı varsayımıyla) */
ctx.clearRect(0, 0, size, size);
ctx.beginPath();
ctx.arc(cx, cy, r, 0, Math.PI * 2);
ctx.fillStyle = '#4b5563';
ctx.fill();
ctx.strokeStyle = '#1f2937';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(cx - r * 0.55, cy);
ctx.lineTo(cx + r * 0.55, cy);
ctx.stroke();

fs.writeFileSync(outDead, canvas.toBuffer('image/png'));
console.log('Yazıldı:', outDead);
