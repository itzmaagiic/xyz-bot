// Builds dist/chrome (+ zip) and dist/pokelike-bot.user.js / .meta.js from the shared sources.
// usage: node scripts/build.mjs [all|chrome|userscript]
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  MATCHES,
  NO_GRANT_NEEDED,
  buildMeta,
  checkUserscript,
  compatWarnings,
  platformLeaks,
  es2020SyntaxError,
  toTemplateLiteral,
  usedGmApis,
} from './userscript-meta.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const target = process.argv[2] ?? 'all';
// PKBOT_DIST lets tests build into a temporary directory
const dist = process.env.PKBOT_DIST ? resolve(process.env.PKBOT_DIST) : join(root, 'dist');

const FLAGS_DEFINE = {
  __PKBOT_FLAGS__: process.env.PKBOT_FLAGS ? JSON.stringify(JSON.parse(process.env.PKBOT_FLAGS)) : 'undefined',
  __PKBOT_VERSION__: JSON.stringify(pkg.version), // run logs carry the bot version (D-038)
};
const common = {
  define: FLAGS_DEFINE,
  bundle: true,
  format: 'iife',
  target: ['chrome111', 'safari15'],
  legalComments: 'none',
  logLevel: 'warning',
};

// Userscript and its embedded bridge: ES2020 (Safari iOS 15), readable, not minified (R-107)
const USERSCRIPT_TARGET = ['es2020'];
const BRIDGE_PLACEHOLDER = '__PKBOT_BRIDGE_SRC__';

async function bundleToString(entry) {
  const r = await build({
    ...common,
    target: USERSCRIPT_TARGET,
    entryPoints: [join(root, entry)],
    write: false,
    minify: false,
  });
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
      { matches: [...MATCHES], js: ['bridge.js'], run_at: 'document_idle', world: 'MAIN' },
      { matches: [...MATCHES], js: ['content.js'], run_at: 'document_idle' },
    ],
    commands: {
      'toggle-bot': { suggested_key: { default: 'Alt+Shift+P' }, description: 'Bot starten/pausieren' },
      'step-bot': { suggested_key: { default: 'Alt+Shift+S' }, description: 'Einen Schritt ausführen' },
      'toggle-overlay': { suggested_key: { default: 'Alt+Shift+O' }, description: 'Overlay ein-/ausblenden' },
    },
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // artifact check (R-032, D-036): no userscript GM API in the Chrome bundles
  for (const f of Object.keys(entries)) {
    const leaks = platformLeaks(readFileSync(join(out, `${f}.js`), 'utf8'), 'chrome');
    if (leaks.length) throw new Error(`GM API in Chrome bundle ${f}.js: ${leaks.join(', ')} (R-032)`);
  }
  zip(out, join(dist, `pokelike-bot-chrome-${pkg.version}.zip`));
  console.log(`chrome → dist/chrome (+ zip)`);
}

async function buildUserscript() {
  mkdirSync(dist, { recursive: true });
  const bridge = await bundleToString('src/platform/chrome/bridge-main.ts');
  // the bridge is embedded as text, so checkUserscript cannot parse it – check its syntax here (R-107)
  const bridgeSyntax = es2020SyntaxError(bridge);
  if (bridgeSyntax) throw new Error(`page bridge is not valid ES2020 (R-107): ${bridgeSyntax}`);
  const r = await build({
    ...common,
    target: USERSCRIPT_TARGET,
    entryPoints: [join(root, 'src/platform/userscript/main.ts')],
    write: false,
    minify: false,
    define: { ...FLAGS_DEFINE, __BRIDGE_CODE__: BRIDGE_PLACEHOLDER },
  });
  let code = r.outputFiles[0].text;
  const hits = code.split(BRIDGE_PLACEHOLDER).length - 1;
  if (hits !== 1) throw new Error(`bridge placeholder found ${hits}× in the userscript bundle, expected exactly 1`);
  code = code.replace(BRIDGE_PLACEHOLDER, () => toTemplateLiteral(bridge)); // function form: no $-patterns
  // @grant is derived from what the bundle really uses (R-104); every used GM API is granted (NO_GRANT_NEEDED is empty)
  const grants = usedGmApis(code)
    .gm.filter((a) => !NO_GRANT_NEEDED.includes(a))
    .map((a) => 'GM.' + a);
  const meta = buildMeta({ version: pkg.version, description: pkg.description, grants });
  const userJs = meta + '\n' + code;
  // check first, write after: a bundle that violates the rules never lands in dist/ (committed in P7, R-203)
  const errs = checkUserscript({ userJs, metaJs: meta, version: pkg.version });
  if (errs.length) {
    console.error('userscript check FAILED (R-192/R-193):\n  - ' + errs.join('\n  - '));
    process.exit(1);
  }
  for (const w of compatWarnings(userJs)) console.warn(`userscript compat warning (Safari 15.0, R-107): ${w}`);
  writeFileSync(join(dist, 'pokelike-bot.meta.js'), meta);
  writeFileSync(join(dist, 'pokelike-bot.user.js'), userJs);
  console.log(
    `userscript → ${relative(root, dist) || '.'}/pokelike-bot.user.js + .meta.js (check OK, grants: ${grants.join(', ') || 'none'})`,
  );
}

if (target === 'all' || target === 'chrome') await buildChrome();
if (target === 'all' || target === 'userscript') await buildUserscript();
