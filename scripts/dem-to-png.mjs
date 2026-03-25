/**
 * Build-time script: Convert GeoTIFF DEM to grayscale PNG heightmap.
 * Run: node scripts/dem-to-png.mjs
 *
 * Reads ICELAND_90_DEM.tif, normalizes elevation to 0-255 grayscale,
 * writes iceland_heightmap.png + iceland_dem_meta.json to public/data/.
 *
 * The metadata JSON stores geo-bounds so the map can project lat/lng to pixels.
 */

import { readFile, writeFile } from 'fs/promises';
import { fromArrayBuffer } from 'geotiff';

const INPUT = 'public/data/ICELAND_90_DEM.tif';
const OUTPUT_PNG = 'public/data/iceland_heightmap.png';
const OUTPUT_META = 'public/data/iceland_dem_meta.json';

async function main() {
  console.log(`Reading ${INPUT}...`);
  const buffer = await readFile(INPUT);
  const tiff = await fromArrayBuffer(buffer.buffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]
  const origin = image.getOrigin();    // [x, y, z]
  const resolution = image.getResolution(); // [xRes, yRes, zRes]

  console.log(`DEM: ${width}x${height}, bbox: [${bbox.map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`Origin: [${origin.map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`Resolution: [${resolution.map(v => v.toFixed(6)).join(', ')}]`);

  console.log('Reading raster data...');
  const rasters = await image.readRasters();
  const data = rasters[0]; // first band — elevation

  // Find min/max elevation (excluding nodata)
  let minElev = Infinity;
  let maxElev = -Infinity;
  const NODATA = -9999;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v > NODATA && v < 3000) { // Iceland max is ~2110m
      if (v < minElev) minElev = v;
      if (v > maxElev) maxElev = v;
    }
  }
  console.log(`Elevation range: ${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m`);

  // Create raw RGBA pixel buffer
  const pixels = new Uint8Array(width * height * 4);
  const elevRange = maxElev - minElev || 1;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const idx = i * 4;
    if (v <= NODATA || v > 3000) {
      // Ocean/nodata → black, transparent
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    } else {
      // Normalize to 0-255 grayscale
      const norm = Math.max(0, Math.min(255, Math.round(((v - minElev) / elevRange) * 255)));
      pixels[idx] = norm;
      pixels[idx + 1] = norm;
      pixels[idx + 2] = norm;
      pixels[idx + 3] = 255;
    }
  }

  // Write PNG using minimal encoder (no dependency needed — use raw format)
  // We'll create a simple PNG with zlib
  console.log('Encoding PNG...');
  const png = await encodePNG(pixels, width, height);
  await writeFile(OUTPUT_PNG, png);
  console.log(`Written ${OUTPUT_PNG} (${(png.length / 1024 / 1024).toFixed(1)} MB)`);

  // Write metadata
  const meta = {
    width,
    height,
    bbox, // [minLng, minLat, maxLng, maxLat] in projected coords
    origin,
    resolution,
    minElev,
    maxElev,
  };
  await writeFile(OUTPUT_META, JSON.stringify(meta, null, 2));
  console.log(`Written ${OUTPUT_META}`);
}

/** Minimal PNG encoder using Node's zlib */
async function encodePNG(pixels, width, height) {
  const { deflateSync } = await import('zlib');

  // PNG raw data: filter byte + row data for each row
  const rawSize = height * (1 + width * 4);
  const raw = new Uint8Array(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    const rowStart = y * width * 4;
    raw.set(pixels.subarray(rowStart, rowStart + width * 4), offset);
    offset += width * 4;
  }

  const compressed = deflateSync(Buffer.from(raw), { level: 6 });

  // Build PNG file
  const chunks = [];

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT
  chunks.push(makeChunk('IDAT', compressed));

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
