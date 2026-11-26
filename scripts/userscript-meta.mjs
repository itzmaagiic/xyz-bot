// Userscript metadata block, GM-API usage detection and the bundle check (R-099, R-103–R-105, R-107, R-192, R-193).
// Pure functions: used by scripts/build.mjs (fails the build), scripts/check-userscript.mjs and the unit tests.
import * as espree from 'espree';

/** GM API intersection of Userscripts (iOS), Tampermonkey and Violentmonkey (R-099, docs/USERSCRIPT_API.md). */
export const ALLOWED_GM = Object.freeze([
  'getValue',
  'setValue',
  'deleteValue',
  'listValues',
  'addStyle',
  'setClipboard',
  'info',
]);
/** Available without @grant in all three managers (quoid README: "GM.info … without needing to add it to @grant"). */
export const NO_GRANT_NEEDED = Object.freeze(['info']);
export const NAMESPACE = 'https://github.com/itzmaagiic/xyz-bot';
export const RAW_BASE = 'https://raw.githubusercontent.com/itzmaagiic/xyz-bot/main/dist/';
export const MATCHES = Object.freeze(['https://pokelike.xyz/*', 'https://www.pokelike.xyz/*']);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_LINE = 400;
const MAX_LONG_LINES = 2;

/**
 * GM APIs referenced in bundled code (without the metadata block).
 * `aliased` counts `GM` references that are neither `GM.<name>` nor `typeof GM` – those would hide which API is
 * used, so the check rejects them.
 */
export function usedGmApis(code) {
  const gm = new Set();
  const legacy = new Set();
  for (const m of code.matchAll(/\bGM\.(\w+)/g)) gm.add(m[1]);
  for (const m of code.matchAll(/\bGM_(\w+)/g)) legacy.add(m[1]);
  let aliased = 0;
  for (const m of code.matchAll(/\bGM\b/g)) {
    const after = code.slice(m.index + 2, m.index + 4);
    const before = code.slice(Math.max(0, m.index - 7), m.index);
    if (/^\.\w/.test(after) || before === 'typeof ') continue;
    aliased++;
  }
  return { gm: [...gm].sort(), legacy: [...legacy].sort(), aliased };
}

/**
 * Built-ins and CSS that Safari only has after 15.0 (R-107: "läuft ab Safari iOS 15"). Scanned in the whole file,
 * including the embedded bridge text. Source: MDN browser-compat data (Safari versions in the messages).
 */
const POST_SAFARI15 = [
  // [pattern, what, global name that may be feature-detected with `typeof <name>` on the same line (R-100)]
  [/\.at\(/, 'Array/String.prototype.at (Safari 15.4)'],
  [/\bstructuredClone\(/, 'structuredClone (Safari 15.4)', 'structuredClone'],
  [/\bObject\.hasOwn\(/, 'Object.hasOwn (Safari 15.4)', 'Object.hasOwn'],
  [/\.findLast(?:Index)?\(/, 'Array.prototype.findLast (Safari 15.4)'],
  [/\bcrypto\.randomUUID\(/, 'crypto.randomUUID (Safari 15.4)', 'crypto.randomUUID'],
  [/:has\(/, 'CSS :has() (Safari 15.4)'],
  [/\.(?:toSorted|toReversed|toSpliced)\(/, 'Array change-by-copy (Safari 16)'],
  [/\bAbortSignal\.timeout\(/, 'AbortSignal.timeout (Safari 16)', 'AbortSignal.timeout'],
  [/\bArray\.fromAsync\(/, 'Array.fromAsync (Safari 16.4)', 'Array.fromAsync'],
  [/\b(?:Object|Map)\.groupBy\(/, 'Object/Map.groupBy (Safari 17.4)'],
  [/\bPromise\.withResolvers\(/, 'Promise.withResolvers (Safari 17.4)', 'Promise.withResolvers'],
  // lookbehind is a parse-time SyntaxError before Safari 16.4 – the whole userscript would fail to load
  [/\(\?<[=!]/, 'RegExp lookbehind (Safari 16.4)'],
];

/** lines of `text` that use a post-Safari-15.0 feature without a same-line `typeof <global>` guard */
function unguardedNewApis(text) {
  const found = new Set();
  for (const line of text.split('\n'))
    for (const [re, what, global] of POST_SAFARI15)
      if (re.test(line) && !(global && line.includes(`typeof ${global}`))) found.add(what);
  return [...found];
}

/** null if `code` parses as ES2020 script, else the parser message (R-107). */
export function es2020SyntaxError(code) {
  try {
    espree.parse(code, { ecmaVersion: 2020, sourceType: 'script' });
    return null;
  } catch (e) {
    return `${e.message} (line ${e.lineNumber ?? '?'})`;
  }
}

/** Backtick literal that evaluates to exactly `s` and keeps its line breaks (readable embedding, R-107). */
export function toTemplateLiteral(s) {
  const body = s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\r/g, '\\r'); // a raw CR would be normalised to LF inside a template literal
  return '`' + body + '`';
}

const pad = (key) => ('// @' + key + ' ').padEnd(17, ' '); // values in column 17, as before

export function buildMeta({ version, description, grants }) {
  const g = grants.length ? grants : ['none'];
  return [
    '// ==UserScript==',
    pad('name') + 'Pokelike Bot',
    pad('namespace') + NAMESPACE,
    pad('version') + version,
    pad('description') + description,
    ...MATCHES.map((m) => pad('match') + m),
    pad('run-at') + 'document-idle',
    pad('inject-into') + 'content',
    '// @noframes',
    ...g.map((x) => pad('grant') + x),
    pad('updateURL') + RAW_BASE + 'pokelike-bot.meta.js',
    pad('downloadURL') + RAW_BASE + 'pokelike-bot.user.js',
    '// ==/UserScript==',
    '',
  ].join('\n');
}

function parseMeta(metaJs) {
  const keys = new Map();
  const body = metaJs.split('// ==/UserScript==')[0] ?? '';
  for (const line of body.split('\n')) {
    const m = /^\/\/ @([\w-]+)(?:\s+(.*?))?\s*$/.exec(line);
    if (!m) continue;
    if (!keys.has(m[1])) keys.set(m[1], []);
    keys.get(m[1]).push(m[2] ?? '');
  }
  return keys;
}

/** Returns the list of problems; an empty list means the userscript satisfies R-099 and R-103–R-107. */
export function checkUserscript({ userJs, metaJs, version }) {
  const errs = [];
  const meta = parseMeta(metaJs);
  const one = (k) => (meta.get(k) ?? [])[0];
  const expect1 = (k, v) => {
    if (one(k) !== v) errs.push(`@${k} must be "${v}", is "${one(k) ?? '(missing)'}"`);
  };

  if (!metaJs.startsWith('// ==UserScript==') || !metaJs.includes('// ==/UserScript=='))
    errs.push('metadata block frame missing');
  if (!one('name')) errs.push('@name missing');
  expect1('namespace', NAMESPACE);
  if (one('version') !== version) errs.push(`@version must be ${version}, is ${one('version') ?? '(missing)'}`);
  if (!SEMVER.test(one('version') ?? '')) errs.push('@version is not SemVer');
  if (!one('description')) errs.push('@description missing');
  for (const m of MATCHES) if (!(meta.get('match') ?? []).includes(m)) errs.push(`@match ${m} missing`);
  expect1('run-at', 'document-idle');
  expect1('inject-into', 'content');
  if (!meta.has('noframes')) errs.push('@noframes missing');
  expect1('updateURL', RAW_BASE + 'pokelike-bot.meta.js');
  expect1('downloadURL', RAW_BASE + 'pokelike-bot.user.js');
  if (meta.has('require')) errs.push('@require is not allowed: everything is bundled (R-107)');

  if (!userJs.startsWith(metaJs)) errs.push('pokelike-bot.user.js must start with the .meta.js block');
  const code = userJs.startsWith(metaJs) ? userJs.slice(metaJs.length) : userJs;

  const used = usedGmApis(code);
  for (const l of used.legacy) errs.push(`legacy API GM_${l} used – only the GM.* intersection is allowed (R-099)`);
  for (const a of used.gm)
    if (!ALLOWED_GM.includes(a)) errs.push(`GM.${a} is outside the allowed intersection (R-099/R-192)`);
  if (used.aliased) errs.push(`GM is aliased ${used.aliased}× – use GM.<name> literally so grants can be derived`);
  const needed = used.gm.filter((a) => !NO_GRANT_NEEDED.includes(a)).map((a) => 'GM.' + a);
  const grants = (meta.get('grant') ?? []).filter((g) => g !== 'none');
  for (const n of needed) if (!grants.includes(n)) errs.push(`missing @grant ${n}`);
  for (const g of grants) if (!needed.includes(g)) errs.push(`superfluous @grant ${g}`);
  if (!needed.length && !(meta.get('grant') ?? []).includes('none'))
    errs.push('@grant none expected when no GM API is used');

  if (/\?\?=|\|\|=|&&=/.test(code)) errs.push('ES2021 logical assignment in bundle – target must be es2020 (R-107)');
  const syntax = es2020SyntaxError(code);
  if (syntax) errs.push(`bundle is not valid ES2020 (Safari iOS 15, R-107): ${syntax}`);
  for (const what of unguardedNewApis(userJs))
    errs.push(`uses ${what} – newer than Safari 15, not feature-detected (R-107)`);
  const long = code.split('\n').filter((l) => l.length > MAX_LINE).length;
  if (long > MAX_LONG_LINES) errs.push(`${long} lines longer than ${MAX_LINE} chars – bundle looks minified (R-107)`);
  return errs;
}
