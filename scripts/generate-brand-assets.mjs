import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const FONTS_DIR = path.join(PUBLIC_DIR, 'fonts');

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function fontCss({ syneWoff2B64, dmSansWoff2B64 }) {
  return `
    @font-face {
      font-family: "Syne";
      font-style: normal;
      font-weight: 800;
      src: url(data:font/woff2;base64,${syneWoff2B64}) format("woff2");
    }
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 500;
      src: url(data:font/woff2;base64,${dmSansWoff2B64}) format("woff2");
    }
  `.trim();
}

function svgP({ size }) {
  // Slightly oversized P for legibility at small sizes
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      text { font-family: "Syne", sans-serif; font-weight: 800; fill: #ffffff; }
    </style>
  </defs>
  <text x="50%" y="62%" text-anchor="middle" font-size="${Math.round(size * 0.78)}" letter-spacing="-0.03em">P</text>
</svg>
  `.trim();
}

function svgOg({ syneCss, dmCss }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style type="text/css">
      ${syneCss}
      ${dmCss}
      .wordmark { font-family: "Syne", sans-serif; font-weight: 800; fill: #ffffff; letter-spacing: -0.03em; }
      .tagline { font-family: "DM Sans", sans-serif; font-weight: 500; fill: rgba(138,138,154,0.9); letter-spacing: -0.01em; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="#09090B"/>
  <text x="600" y="315" text-anchor="middle" class="wordmark" font-size="164">pulp</text>
  <text x="600" y="390" text-anchor="middle" class="tagline" font-size="40">AI MIDI Generator</text>
</svg>
  `.trim();
}

async function writePngFromSvg(svg, outPath, size) {
  await sharp(Buffer.from(svg)).png().resize(size, size).toFile(outPath);
}

async function main() {
  const syneWoff2 = await fs.readFile(path.join(FONTS_DIR, 'syne-800-latin.woff2'));
  const dmSansWoff2 = await fs.readFile(path.join(FONTS_DIR, 'dm-sans-latin.woff2'));
  const css = fontCss({ syneWoff2B64: b64(syneWoff2), dmSansWoff2B64: b64(dmSansWoff2) });

  // Icon PNGs
  const pSvg = svgP({ size: 512 });
  const icon16 = path.join(PUBLIC_DIR, 'favicon-16.png');
  const icon32 = path.join(PUBLIC_DIR, 'favicon-32.png');

  // Render a large base and downscale for crispness
  const basePng = await sharp(Buffer.from(pSvg))
    .png()
    .resize(1024, 1024)
    .toBuffer();

  await sharp(basePng).resize(16, 16).png().toFile(icon16);
  await sharp(basePng).resize(32, 32).png().toFile(icon32);
  await sharp(basePng).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  await sharp(basePng).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, 'apple-icon.png'));
  await sharp(basePng).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, 'android-chrome-192x192.png'));
  await sharp(basePng).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, 'android-chrome-512x512.png'));
  // Keep manifest filenames stable
  await sharp(basePng).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, 'icon-192.png'));
  await sharp(basePng).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, 'icon-512.png'));

  // favicon.ico (multi-size)
  const ico = await pngToIco([await fs.readFile(icon16), await fs.readFile(icon32)]);
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), ico);

  // OG image
  const ogSvg = svgOg({
    syneCss: css.split('\n').slice(0, 7).join('\n'),
    dmCss: css.split('\n').slice(7).join('\n'),
  });
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  await fs.writeFile(path.join(PUBLIC_DIR, 'og-image.svg'), ogSvg, 'utf8');

  console.log('Generated brand assets in public/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

