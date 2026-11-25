// Builds dist/chrome (+ zip) and dist/pokelike-bot.user.js / .meta.js from the shared sources.
// usage: node scripts/build.mjs [all|chrome|userscript]
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const target = process.argv[2] ?? 'all';
const dist = join(root, 'dist');
const MATCHES = ['https://pokelike.xyz/*', 'https://www.pokelike.xyz/*'];

const FLAGS_DEFINE = {
  __PKBOT_FLAGS__: process.env.PKBOT_FLAGS ? JSON.stringify(JSON.parse(process.env.PKBOT_FLAGS)) : 'undefined',
};
const common = {
  define: FLAGS_DEFINE,
  bundle: true,
  format: 'iife',
  target: ['chrome111', 'safari15'],
  legalComments: 'none',
  logLevel: 'warning',
};

async function bundleToString(entry) {
  const r = await build({ ...common, entryPoints: [join(root, entry)], write: false, minify: true });
  return r.outputFiles[0].text;
}

// ---------- tiny PNG encoder for the extension icons (no extra dependency) ----------
function png(size) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    px[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c,
        dy = y + 0.5 - c,
        d = Math.sqrt(dx * dx + dy * dy) / c;
      let rgba = [0, 0, 0, 0];
      if (d <= 0.96) {
        const band = Math.abs(dy) < size * 0.06;
        rgba = d > 0.86 || band ? [20, 24, 38, 255] : dy < 0 ? [230, 57, 70, 255] : [245, 245, 250, 255];
        if (d < 0.3 && d > 0.18) rgba = [20, 24, 38, 255];
        if (d <= 0.18) rgba = [56, 214, 230, 255];
      }
      px.set(rgba, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(px)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- minimal ZIP writer (deflate) ----------
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fixed date → reproducible zips
function zip(dir, outFile) {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  const local = [],
    central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(relative(dir, f).split('\\').join('/'));
    const data = readFileSync(f);
    const comp = deflateSync(data, { level: 9 }).subarray(2, -4); // raw deflate
    const crc = crc32(data) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0, 6);
    h.writeUInt16LE(8, 8);
    h.writeUInt16LE(0, 10);
    h.writeUInt16LE(DOS_DATE, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    h.writeUInt16LE(0, 28);
    local.push(h, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(outFile, Buffer.concat([...local, cd, end]));
}

async function buildChrome() {
  const out = join(dist, 'chrome');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'icons'), { recursive: true });
  const entries = {
    content: 'content.ts',
    bridge: 'bridge-main.ts',
    background: 'background.ts',
    popup: 'popup.ts',
    options: 'options.ts',
  };
  await build({
    ...common,
    entryPoints: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, join(root, 'src/platform/chrome', v)])),
    outdir: out,
    minify: false,
  });
  for (const f of ['popup.html', 'options.html', 'ui.css'])
    copyFileSync(join(root, 'src/platform/chrome/static', f), join(out, f));
  for (const s of [16, 32, 48, 128]) writeFileSync(join(out, 'icons', `icon${s}.png`), png(s));
  const icons = { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
  const manifest = {
    manifest_version: 3,
    name: 'Pokelike Bot',
    version: pkg.version,
    description: pkg.description,
    minimum_chrome_version: '111',
    icons,
    action: { default_popup: 'popup.html', default_icon: icons, default_title: 'Pokelike Bot' },
    options_page: 'options.html',
    background: { service_worker: 'background.js' },
    permissions: ['storage', 'notifications'],
    content_scripts: [
      { matches: MATCHES, js: ['bridge.js'], run_at: 'document_idle', world: 'MAIN' },
      { matches: MATCHES, js: ['content.js'], run_at: 'document_idle' },
    ],
    commands: {
      'toggle-bot': { suggested_key: { default: 'Alt+Shift+P' }, description: 'Bot starten/pausieren' },
      'step-bot': { suggested_key: { default: 'Alt+Shift+S' }, description: 'Einen Schritt ausführen' },
      'toggle-overlay': { suggested_key: { default: 'Alt+Shift+O' }, description: 'Overlay ein-/ausblenden' },
    },
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  zip(out, join(dist, `pokelike-bot-chrome-${pkg.version}.zip`));
  console.log(`chrome → dist/chrome (+ zip)`);
}

async function buildUserscript() {
  mkdirSync(dist, { recursive: true });
  const bridge = await bundleToString('src/platform/chrome/bridge-main.ts');
  const r = await build({
    ...common,
    entryPoints: [join(root, 'src/platform/userscript/main.ts')],
    write: false,
    minify: false,
    define: { ...FLAGS_DEFINE, __BRIDGE_CODE__: JSON.stringify(bridge) },
  });
  const meta = [
    '// ==UserScript==',
    '// @name         Pokelike Bot',
    '// @namespace    https://github.com/itzmaagiic/xyz-bot',
    `// @version      ${pkg.version}`,
    `// @description  ${pkg.description}`,
    ...MATCHES.map((m) => `// @match        ${m}`),
    '// @run-at       document-idle',
    '// @noframes',
    '// @grant        GM.getValue',
    '// @grant        GM.setValue',
    '// @grant        GM.setClipboard',
    '// @grant        GM_getValue',
    '// @grant        GM_setValue',
    '// @grant        GM_setClipboard',
    '// @grant        GM_addValueChangeListener',
    '// @inject-into  content',
    '// ==/UserScript==',
    '',
  ].join('\n');
  writeFileSync(join(dist, 'pokelike-bot.meta.js'), meta);
  writeFileSync(join(dist, 'pokelike-bot.user.js'), meta + '\n' + r.outputFiles[0].text);
  console.log('userscript → dist/pokelike-bot.user.js + .meta.js');
}

if (target === 'all' || target === 'chrome') await buildChrome();
if (target === 'all' || target === 'userscript') await buildUserscript();
