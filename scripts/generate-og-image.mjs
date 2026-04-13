import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fontPath = path.join(root, 'public', 'fonts', 'syne-800-latin.woff2');
const outPng = path.join(root, 'public', 'og-image.png');
const outWebp = path.join(root, 'public', 'og-image.webp');

const fontBuf = await fs.readFile(fontPath);
const fontB64 = fontBuf.toString('base64');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Syne';
        font-style: normal;
        font-weight: 800;
        font-display: block;
        src: url(data:font/woff2;base64,${fontB64}) format('woff2');
      }
    ]]></style>
    <radialGradient id="ogGlow" cx="50%" cy="42%" r="58%" fx="50%" fy="42%">
      <stop offset="0%" stop-color="#FF6D3F" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#FF6D3F" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ogGlow2" cx="72%" cy="68%" r="42%" fx="72%" fy="68%">
      <stop offset="0%" stop-color="#FF6D3F" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090B"/>
  <rect width="1200" height="630" fill="url(#ogGlow)"/>
  <rect width="1200" height="630" fill="url(#ogGlow2)"/>
  <text x="600" y="298" text-anchor="middle" font-family="Syne, sans-serif" font-weight="800" font-size="152" fill="#FFFFFF" letter-spacing="-0.03em">pulp.</text>
  <text x="600" y="398" text-anchor="middle" font-family="Syne, sans-serif" font-weight="800" font-size="44" fill="#FF6D3F" letter-spacing="0.02em">AI MIDI Generator</text>
</svg>`;

const raster = sharp(Buffer.from(svg)).resize(1200, 630);
await raster.png().toFile(outPng);
await sharp(Buffer.from(svg)).resize(1200, 630).webp({ quality: 88 }).toFile(outWebp);
console.log('Wrote', path.relative(root, outPng), 'and', path.relative(root, outWebp));
