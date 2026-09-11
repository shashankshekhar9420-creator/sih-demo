#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

// Find @imgly/background-removal-node package directory
let imglyPkg;
try {
  imglyPkg = require.resolve('@imgly/background-removal-node');
} catch {
  const rootNodeModules = path.resolve(__dirname, '../node_modules/@imgly/background-removal-node');
  imglyPkg = path.join(rootNodeModules, 'dist/index.cjs');
}

const { removeBackground } = require(imglyPkg);
const distDir = path.dirname(imglyPkg);
const publicPath = url.pathToFileURL(distDir).href + '/';

// Use sharp associated with @imgly to avoid version conflicts with Next.js sharp
let sharp;
try {
  sharp = require(path.join(distDir, '../node_modules/sharp'));
} catch {
  try {
    sharp = require('@imgly/background-removal-node/node_modules/sharp');
  } catch {
    sharp = require('sharp');
  }
}

function shadowSvg(width, height) {
  const cx = Math.round(width / 2);
  const cy = Math.round(height * 0.945);
  const rx = Math.round(width * 0.33);
  const ry = Math.round(Math.max(6, height * 0.038));
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.max(6, Math.round(width * 0.012))}"/></filter></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,0.14)" filter="url(#b)"/>
  </svg>`;
  return Buffer.from(svg);
}

async function processImage(inputPath, outputPath) {
  const inputBuffer = fs.readFileSync(inputPath);
  const isPng = inputBuffer.length >= 8 && inputBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const mime = isPng ? 'image/png' : 'image/jpeg';

  const inputBlob = new Blob([inputBuffer], { type: mime });

  // Run model inference for background removal
  const outBlob = await removeBackground(inputBlob, {
    publicPath,
    model: 'small',
    output: { format: 'image/png' },
  });

  const cutoutBuffer = Buffer.from(await outBlob.arrayBuffer());
  const meta = await sharp(cutoutBuffer).metadata();
  const width = meta.width || 800;
  const height = meta.height || 800;

  // Solid pure white background (#ffffff)
  const whiteCanvas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  // Composite contact shadow at the base, then product cutout over pure white
  const shadow = shadowSvg(width, height);
  const resultJpg = await sharp(whiteCanvas)
    .composite([
      { input: shadow, blend: 'over' },
      { input: cutoutBuffer, blend: 'over' },
    ])
    .modulate({ brightness: 1.03, saturation: 1.02 })
    .sharpen({ sigma: 0.4, m1: 0.8, m2: 1.5 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, resultJpg);

  return { success: true, width, height, bytes: resultJpg.length };
}

if (require.main === module) {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error(JSON.stringify({ success: false, error: 'Usage: process_image.cjs <input> <output>' }));
    process.exit(2);
  }

  processImage(inPath, outPath)
    .then(res => {
      console.log(JSON.stringify(res));
      process.exit(0);
    })
    .catch(err => {
      console.error(JSON.stringify({ success: false, error: String(err && err.message ? err.message : err) }));
      process.exit(1);
    });
}

module.exports = { processImage };
