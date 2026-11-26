// usage: npm run runs:import -- <pkbot-runs-YYYYMMDD-HHMMSS.json>
// Takes a run export from the overlay ("Runs exportieren") into runs/ after the secret scan (R-007, R-148, R-210).
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRunDirs } from './runs-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) {
  console.error('usage: npm run runs:import -- <pkbot-runs-….json>');
  process.exit(2);
}
try {
  const dirs = writeRunDirs(JSON.parse(readFileSync(file, 'utf8')), join(root, 'runs'));
  console.log(dirs.length ? dirs.map((d) => `→ ${relative(root, d)}`).join('\n') : 'no runs in this export');
} catch (e) {
  console.error(`runs:import FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
