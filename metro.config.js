const { getDefaultConfig } = require('expo/metro-config');
const fs = require('node:fs');
const path = require('node:path');

// Expo's web dev server serves files in public/ at the root URL.
// Skia's CanvasKit loader requests /canvaskit.wasm directly. Without the
// binary, Metro returns the HTML fallback (starting with <!do), which
// causes "expected magic word 00 61 73 6d" on WebAssembly.instantiate().
const wasmSource = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
const publicDir = path.join(__dirname, 'public');
const wasmTarget = path.join(publicDir, 'canvaskit.wasm');
fs.mkdirSync(publicDir, { recursive: true });

const isWasm = (file) => {
  if (!fs.existsSync(file)) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(4);
    return fs.readSync(fd, header, 0, 4, 0) === 4 &&
      header.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
  } finally {
    fs.closeSync(fd);
  }
};
if (!isWasm(wasmSource)) {
  throw new Error('CanvasKit WASM source is missing or invalid: ' + wasmSource);
}
if (!fs.existsSync(wasmTarget) ||
    fs.statSync(wasmTarget).size !== fs.statSync(wasmSource).size ||
    !isWasm(wasmTarget)) {
  fs.copyFileSync(wasmSource, wasmTarget);
}
console.log('[Notex] CanvasKit WASM ready: public/canvaskit.wasm');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
module.exports = config;
