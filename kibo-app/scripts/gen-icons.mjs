// Generates the PWA icon set from one vector source.
//
//   node scripts/gen-icons.mjs
//
// Run it when the artwork changes and commit the PNGs. This is a build-time
// author tool, not part of `next build`: the output is committed, so a deploy
// never depends on it, and neither does anyone who only wants to run the app.
//
// `sharp` is not a declared dependency — it arrives with Next, which uses it for
// image optimisation. That is fine for a script whose failure mode is "run it
// again after npm install", and not fine for anything on a request path. If Next
// ever drops it, install it as a devDependency rather than reaching for a
// different renderer, because the SVG below is tuned against libvips' renderer.
//
// Two fish, because the whole app is two people. Nothing here uses a font:
// libvips needs system fonts present to render text, which makes the output
// depend on the machine that ran it.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join(import.meta.dirname, '..', 'public', 'icons');

// Matches TANK_MOOD_GRADIENT.calm in lib/constants.ts, so the icon and the tank
// it opens are the same colour.
const TANK_TOP = '#0f2c3f';
const TANK_BOTTOM = '#081a26';
const FISH_WARM = '#f2b880';
const FISH_COOL = '#7fd4d0';

/**
 * One fish, pointing right, drawn in a 100x56 box with its nose at x=100.
 * A leaf-shaped body (pointed at both ends) plus a forked tail — the silhouette
 * survives being 24px in a task switcher, which a detailed fish does not.
 */
function fish(color) {
  return `
    <g fill="${color}">
      <path d="M30 28 C30 28 46 4 70 4 C90 4 100 22 100 28 C100 34 90 52 70 52 C46 52 30 28 30 28 Z"/>
      <path d="M31 28 L4 8 L12 28 L4 48 Z"/>
      <circle cx="80" cy="22" r="3.4" fill="${TANK_BOTTOM}"/>
    </g>`;
}

/**
 * @param size    pixel dimensions of the square canvas
 * @param inset   fraction of the canvas the artwork is inset by. Maskable icons
 *                get a large inset because Android crops them to an arbitrary
 *                shape and only guarantees the centre ~80% survives.
 * @param radius  corner radius as a fraction of size. 0 = full bleed, which is
 *                what a maskable icon must be — the launcher supplies the shape,
 *                and a rounded source inside a circular mask shows as a gap.
 */
function svg(size, { inset, radius }) {
  const art = size * (1 - inset * 2);
  const off = size * inset;
  const r = size * radius;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="tank" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TANK_TOP}"/>
      <stop offset="1" stop-color="${TANK_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#tank)"/>
  <g transform="translate(${off} ${off}) scale(${art / 100})">
    <!-- Facing each other, offset vertically: two fish in one tank, mid-pass. -->
    <g transform="translate(2 16) scale(0.62)">${fish(FISH_WARM)}</g>
    <g transform="translate(98 62) scale(-0.62 0.62)">${fish(FISH_COOL)}</g>
  </g>
</svg>`;
}

// The inset values are load-bearing and were set by looking at the output. The
// fish span nearly the full art box, and a rounded corner eats the diagonal — at
// inset 0 the two tail tips sat inside the corner radius and read as clipped.
const TARGETS = [
  // `purpose: any`. Chrome requires 192 and 512 to call the app installable.
  { file: 'icon-192.png', size: 192, inset: 0.1, radius: 0.22 },
  { file: 'icon-512.png', size: 512, inset: 0.1, radius: 0.22 },
  // `purpose: maskable`. Full bleed, art pulled well inside the safe zone.
  { file: 'icon-512-maskable.png', size: 512, inset: 0.2, radius: 0 },
  // iOS ignores the manifest for the home-screen icon and reads this instead.
  // It also does not round-trip transparency, so this one is opaque and square,
  // and iOS applies its own corner radius on top.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.1, radius: 0 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, inset, radius } of TARGETS) {
  const source = Buffer.from(svg(size, { inset, radius }));
  const png = await sharp(source, { density: 384 }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT_DIR, file), png);
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

// A monochrome mask for Safari pinned tabs / any consumer that wants a flat
// shape. Written as SVG because that is what those consumers accept.
await writeFile(
  path.join(OUT_DIR, 'icon-mono.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <g transform="translate(0 18) scale(1)">
    <g transform="translate(0 0) scale(0.62)" fill="#000">
      <path d="M30 28 C30 28 46 4 70 4 C90 4 100 22 100 28 C100 34 90 52 70 52 C46 52 30 28 30 28 Z"/>
      <path d="M31 28 L4 8 L12 28 L4 48 Z"/>
    </g>
  </g>
</svg>\n`
);
console.log('icon-mono.svg');
