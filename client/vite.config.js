import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo: kökteki .env / Vercel ortam değişkenleri VITE_* buradan okunur */
export default defineConfig({
  root: __dirname,
  envDir: path.resolve(__dirname, '..'),
});
