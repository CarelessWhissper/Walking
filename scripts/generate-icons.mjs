import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets", "images");

const GREEN = "#00E676";
const BG = "#0A0A0A";
const SURFACE = "#161616";

/**
 * Generates a running-route icon SVG.
 * A flowing path with a position dot - clean, minimal, instantly says "tracker".
 */
function iconSVG(size, padding = 0.2) {
  const p = size * padding;
  const w = size - p * 2;

  // Route path control points (S-curve flowing upward-right)
  const sx = p + w * 0.15;
  const sy = p + w * 0.85;
  const c1x = p + w * 0.1;
  const c1y = p + w * 0.35;
  const c2x = p + w * 0.55;
  const c2y = p + w * 0.65;
  const mx = p + w * 0.5;
  const my = p + w * 0.35;
  const c3x = p + w * 0.45;
  const c3y = p + w * 0.05;
  const c4x = p + w * 0.9;
  const c4y = p + w * 0.2;
  const ex = p + w * 0.82;
  const ey = p + w * 0.18;

  const strokeW = size * 0.055;
  const dotR = size * 0.055;

  // Small start marker
  const startDotR = size * 0.03;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}" rx="${size * 0.22}"/>

    <!-- Subtle grid lines for "map" feel -->
    <g opacity="0.06" stroke="#fff" stroke-width="1">
      ${Array.from({ length: 5 }, (_, i) => {
        const pos = p + (w / 6) * (i + 1);
        return `<line x1="${p}" y1="${pos}" x2="${size - p}" y2="${pos}"/>
                <line x1="${pos}" y1="${p}" x2="${pos}" y2="${size - p}"/>`;
      }).join("\n")}
    </g>

    <!-- Route shadow -->
    <path d="M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}"
      fill="none" stroke="${GREEN}" stroke-width="${strokeW + 4}" stroke-linecap="round" stroke-linejoin="round" opacity="0.15"/>

    <!-- Route path -->
    <path d="M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}"
      fill="none" stroke="${GREEN}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Start marker -->
    <circle cx="${sx}" cy="${sy}" r="${startDotR}" fill="${GREEN}" opacity="0.4"/>

    <!-- Current position dot glow -->
    <circle cx="${ex}" cy="${ey}" r="${dotR * 2.5}" fill="${GREEN}" opacity="0.12"/>
    <circle cx="${ex}" cy="${ey}" r="${dotR * 1.5}" fill="${GREEN}" opacity="0.25"/>

    <!-- Current position dot -->
    <circle cx="${ex}" cy="${ey}" r="${dotR}" fill="${GREEN}"/>
    <circle cx="${ex}" cy="${ey}" r="${dotR * 0.45}" fill="${BG}"/>
  </svg>`;
}

/**
 * Adaptive icon foreground (no background, just the route path centered).
 */
function adaptiveForegroundSVG(size) {
  // Android adaptive icons need 108dp with 72dp safe zone (66.7%)
  // Content should be in the center 66.7%
  const safeInset = size * 0.167;
  return iconSVG(size, 0.25);
}

/**
 * Splash icon - larger route with app name beneath.
 */
function splashSVG(size) {
  const iconSize = size * 0.35;
  const iconOffset = (size - iconSize) / 2;

  const p = iconSize * 0.15;
  const w = iconSize - p * 2;

  const sx = p + w * 0.15;
  const sy = p + w * 0.85;
  const c1x = p + w * 0.1;
  const c1y = p + w * 0.35;
  const c2x = p + w * 0.55;
  const c2y = p + w * 0.65;
  const mx = p + w * 0.5;
  const my = p + w * 0.35;
  const c3x = p + w * 0.45;
  const c3y = p + w * 0.05;
  const c4x = p + w * 0.9;
  const c4y = p + w * 0.2;
  const ex = p + w * 0.82;
  const ey = p + w * 0.18;

  const strokeW = iconSize * 0.05;
  const dotR = iconSize * 0.05;
  const startDotR = iconSize * 0.025;

  const textY = iconOffset + iconSize + size * 0.08;
  const subtitleY = textY + size * 0.045;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>

    <g transform="translate(${iconOffset}, ${iconOffset - size * 0.05})">
      <!-- Route shadow -->
      <path d="M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}"
        fill="none" stroke="${GREEN}" stroke-width="${strokeW + 3}" stroke-linecap="round" opacity="0.15"/>
      <!-- Route -->
      <path d="M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}"
        fill="none" stroke="${GREEN}" stroke-width="${strokeW}" stroke-linecap="round"/>
      <!-- Start -->
      <circle cx="${sx}" cy="${sy}" r="${startDotR}" fill="${GREEN}" opacity="0.4"/>
      <!-- End glow -->
      <circle cx="${ex}" cy="${ey}" r="${dotR * 2.5}" fill="${GREEN}" opacity="0.12"/>
      <circle cx="${ex}" cy="${ey}" r="${dotR * 1.5}" fill="${GREEN}" opacity="0.25"/>
      <!-- End dot -->
      <circle cx="${ex}" cy="${ey}" r="${dotR}" fill="${GREEN}"/>
      <circle cx="${ex}" cy="${ey}" r="${dotR * 0.45}" fill="${BG}"/>
    </g>

    <!-- App name -->
    <text x="${size / 2}" y="${textY}" text-anchor="middle"
      font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.055}" font-weight="600"
      letter-spacing="${size * 0.012}" fill="#F5F5F5">TRACK</text>

    <text x="${size / 2}" y="${subtitleY}" text-anchor="middle"
      font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.022}" font-weight="400"
      letter-spacing="${size * 0.006}" fill="#555">RUN TRACKER</text>
  </svg>`;
}

/**
 * Monochrome icon for Android (white on transparent).
 */
function monochromeSVG(size) {
  const p = size * 0.25;
  const w = size - p * 2;

  const sx = p + w * 0.15;
  const sy = p + w * 0.85;
  const c1x = p + w * 0.1;
  const c1y = p + w * 0.35;
  const c2x = p + w * 0.55;
  const c2y = p + w * 0.65;
  const mx = p + w * 0.5;
  const my = p + w * 0.35;
  const c3x = p + w * 0.45;
  const c3y = p + w * 0.05;
  const c4x = p + w * 0.9;
  const c4y = p + w * 0.2;
  const ex = p + w * 0.82;
  const ey = p + w * 0.18;

  const strokeW = size * 0.055;
  const dotR = size * 0.05;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <path d="M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}"
      fill="none" stroke="#FFF" stroke-width="${strokeW}" stroke-linecap="round"/>
    <circle cx="${ex}" cy="${ey}" r="${dotR}" fill="#FFF"/>
  </svg>`;
}

async function generate(name, svg, size) {
  const outPath = path.join(ASSETS, name);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`  ${name} (${size}x${size})`);
}

async function main() {
  console.log("Generating app icons...\n");

  // Main app icon (1024x1024)
  await generate("icon.png", iconSVG(1024), 1024);

  // Favicon (48x48)
  await generate("favicon.png", iconSVG(48, 0.12), 48);

  // Splash icon (320x320 centered content, on dark bg)
  await generate("splash-icon.png", splashSVG(512), 512);

  // Android adaptive icon foreground
  await generate("android-icon-foreground.png", adaptiveForegroundSVG(1024), 1024);

  // Android adaptive icon background (solid dark)
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`;
  await generate("android-icon-background.png", bgSvg, 1024);

  // Android monochrome icon
  await generate("android-icon-monochrome.png", monochromeSVG(1024), 1024);

  console.log("\nDone!");
}

main().catch(console.error);
