import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const appDir = path.join(root, 'src', 'app');
const svgPath = path.join(appDir, 'icon.svg');
const applePngPath = path.join(appDir, 'apple-icon.png');
const faviconIcoPath = path.join(appDir, 'favicon.ico');

const svg = await fs.readFile(svgPath);

// Apple touch icon (180x180)
await sharp(svg, { density: 300 })
  .resize(180, 180, { fit: 'cover' })
  .png()
  .toFile(applePngPath);

// Favicon ICO: bundle common sizes
const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map((s) =>
    sharp(svg, { density: 300 })
      .resize(s, s, { fit: 'cover' })
      .png()
      .toBuffer()
  )
);
const ico = await pngToIco(pngBuffers);
await fs.writeFile(faviconIcoPath, ico);

console.log('Generated:', path.relative(root, applePngPath), path.relative(root, faviconIcoPath));

