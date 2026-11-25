// Checks an already built userscript in dist/ (or PKBOT_DIST) without rebuilding (R-192, R-193).
// usage: npm run check:userscript   – exit 1 with the list of problems if the bundle violates R-099/R-103–R-107
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUserscript } from './userscript-meta.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.PKBOT_DIST ? resolve(process.env.PKBOT_DIST) : join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let userJs, metaJs;
try {
  userJs = readFileSync(join(dist, 'pokelike-bot.user.js'), 'utf8');
  metaJs = readFileSync(join(dist, 'pokelike-bot.meta.js'), 'utf8');
} catch (e) {
  console.error(`userscript not built (${e.message}) – run npm run build:userscript first`);
  process.exit(1);
}
const errs = checkUserscript({ userJs, metaJs, version });
if (errs.length) {
  console.error('userscript check FAILED:\n  - ' + errs.join('\n  - '));
  process.exit(1);
}
console.log(`userscript OK (${dist})`);
