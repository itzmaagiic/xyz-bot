import { describe, expect, it } from 'vitest';
import {
  ALLOWED_GM,
  NO_GRANT_NEEDED,
  RAW_BASE,
  buildMeta,
  checkUserscript,
  compatWarnings,
  platformLeaks,
  es2020SyntaxError,
  toTemplateLiteral,
  usedGmApis,
} from '../../scripts/userscript-meta.mjs';

const V = '1.2.3';
const CODE =
  "(() => {\n  if (typeof GM !== 'undefined') GM.setValue('a', '1');\n  void GM.getValue('a');\n  void GM.info;\n})();\n";

function bundle(code = CODE, grants = ['GM.getValue', 'GM.info', 'GM.setValue'], version = V) {
  const metaJs = buildMeta({ version, description: 'd', grants });
  return { metaJs, userJs: metaJs + '\n' + code, version: V };
}

describe('userscript metadata + bundle check (R-103–R-105, R-107, R-192, R-193)', () => {
  it('ALLOWED_GM is exactly the R-099 intersection; every used GM API is granted', () => {
    expect([...ALLOWED_GM].sort()).toEqual(
      ['addStyle', 'deleteValue', 'getValue', 'info', 'listValues', 'setClipboard', 'setValue'].sort(),
    );
    // GM.info without @grant is only documented for Userscripts (quoid), not verified for TM/VM → always grant it
    expect(NO_GRANT_NEEDED).toEqual([]);
  });

  it('usedGmApis finds GM.x and GM_x, sorted and unique', () => {
    const u = usedGmApis('GM.setValue(1); GM.getValue(2); GM.getValue(3); GM_xmlhttpRequest(); typeof GM;');
    expect(u.gm).toEqual(['getValue', 'setValue']);
    expect(u.legacy).toEqual(['xmlhttpRequest']);
  });

  it('usedGmApis reports aliased GM uses that hide which API is called', () => {
    expect(usedGmApis('const g = GM; g.openInTab();').aliased).toBe(1);
    expect(usedGmApis("if (typeof GM !== 'undefined') GM.info;").aliased).toBe(0);
  });

  it('toTemplateLiteral round-trips backticks, ${, backslashes, CR and line separators', () => {
    const s = 'a`b${c}\\d\n\r\n e $ {x} \\` end';
    expect(new Function('return ' + toTemplateLiteral(s))()).toBe(s);
    expect(toTemplateLiteral('x\ny').split('\n')).toHaveLength(2); // stays multi-line → readable
  });

  it('buildMeta has the R-103 keys, update/download URLs on GitHub raw and no @require', () => {
    const m = buildMeta({ version: V, description: 'd', grants: ['GM.getValue'] });
    expect(m.startsWith('// ==UserScript==\n')).toBe(true);
    expect(m).toContain('// ==/UserScript==');
    expect(m).toMatch(/@match\s+https:\/\/pokelike\.xyz\/\*/);
    expect(m).toMatch(/@run-at\s+document-idle/);
    expect(m).toMatch(/@inject-into\s+content/);
    expect(m).toMatch(/@noframes/);
    expect(m).toContain(`@updateURL    ${RAW_BASE}pokelike-bot.meta.js`);
    expect(m).toContain(`@downloadURL  ${RAW_BASE}pokelike-bot.user.js`);
    expect(RAW_BASE).toBe('https://raw.githubusercontent.com/itzmaagiic/xyz-bot/main/dist/');
    expect(m).not.toContain('@require');
  });

  it('checkUserscript passes a clean bundle', () => {
    expect(checkUserscript(bundle())).toEqual([]);
  });

  it.each([
    ['legacy GM_ API', () => bundle(CODE + 'GM_getValue("x");\n'), /legacy/],
    [
      'API outside the intersection',
      () => bundle(CODE + 'GM.openInTab("x");\n', ['GM.getValue', 'GM.setValue', 'GM.openInTab']),
      /outside/,
    ],
    ['missing grant', () => bundle(CODE, ['GM.getValue']), /missing @grant GM\.setValue/],
    [
      'superfluous grant',
      () => bundle(CODE, ['GM.getValue', 'GM.setValue', 'GM.addStyle']),
      /superfluous @grant GM\.addStyle/,
    ],
    [
      '@require',
      () => {
        const b = bundle();
        const metaJs = b.metaJs.replace(
          '// ==/UserScript==',
          '// @require      https://x.invalid/a.js\n// ==/UserScript==',
        );
        return { ...b, metaJs, userJs: metaJs + '\n' + CODE };
      },
      /@require/,
    ],
    [
      'wrong @updateURL',
      () => {
        const b = bundle();
        const metaJs = b.metaJs.replace(/(@updateURL\s+)\S+/, '$1https://example.invalid/x.meta.js');
        return { ...b, metaJs, userJs: metaJs + '\n' + CODE };
      },
      /@updateURL/,
    ],
    ['ES2021 logical assignment', () => bundle(CODE + 'let q; q ??= 1;\n'), /ES2021/],
    ['version mismatch', () => bundle(CODE, undefined, '9.9.9'), /@version/],
    [
      'user.js not starting with the meta block',
      () => ({ ...bundle(), userJs: '/* x */\n' + bundle().userJs }),
      /start/,
    ],
    [
      'minified code',
      () => bundle(CODE + Array.from({ length: 3 }, () => 'a=1;'.repeat(120)).join('\n') + '\n'),
      /minified/,
    ],
    ['aliased GM', () => bundle(CODE + 'const g = GM;\n'), /alias/],
    ['syntax newer than ES2020 (class static block)', () => bundle(CODE + 'class A { static { } }\n'), /ES2020/],
    ['API newer than Safari 15.0 (Array.prototype.at)', () => bundle(CODE + 'const z = [1].at(-1);\n'), /Safari 15/],
    [
      'RegExp lookbehind (Safari 16.4, a parse error on iOS 15)',
      () => bundle(CODE + 'const r = /(?<=a)b/;\n'),
      /lookbehind/,
    ],
    [
      'BroadcastChannel without feature detection',
      () => bundle(CODE + 'const c = new BroadcastChannel("x");\n'),
      /BroadcastChannel/,
    ],
    ['Set methods (Safari 17)', () => bundle(CODE + 'const u = a.union(b);\n'), /Set methods/],
    ['requestIdleCallback (not in Safari)', () => bundle(CODE + 'requestIdleCallback(f);\n'), /requestIdleCallback/],
    [
      'a typeof that does not guard the call',
      () => bundle(CODE + 'if (typeof structuredClone) {} structuredClone(x);\n'),
      /structuredClone/,
    ],
    [
      'a chrome.* API in the userscript bundle',
      () => bundle(CODE + 'chrome.storage.local.get("x");\n'),
      /chrome\.\* \/ browser\.\*/,
    ],
    ['negative RegExp lookbehind', () => bundle(CODE + 'const r = /(?<!a)b/;\n'), /lookbehind/],
    [
      'API newer than Safari 15.0 inside the embedded bridge text',
      () => bundle(CODE + 'const b = `structuredClone(x)`;\n'),
      /Safari 15/,
    ],
  ])('checkUserscript flags %s', (_name, make, re) => {
    const errs = checkUserscript(make());
    expect(
      errs.some((e: string) => re.test(e)),
      errs.join(' | '),
    ).toBe(true);
  });

  it('accepts a newer global that is feature-detected on the same line', () => {
    const guarded =
      'var clone = (v) => typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));\n';
    expect(checkUserscript(bundle(CODE + guarded))).toEqual([]);
  });

  it('es2020SyntaxError accepts ES2020 and rejects newer syntax', () => {
    expect(es2020SyntaxError('const a = b?.c ?? 1; async function f() { await g(); }')).toBeNull();
    expect(es2020SyntaxError('let a; a ||= 1;')).toMatch(/./);
    expect(es2020SyntaxError('class A { #x = 1 }')).toMatch(/./);
  });

  it('accepts feature detection with typeof … !== "undefined" before the use', () => {
    const g = 'const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("x") : null;\n';
    expect(checkUserscript(bundle(CODE + g))).toEqual([]);
  });

  it('reports CSS that only degrades on Safari 15.0 as a warning, not an error', () => {
    const css = 'const s = "button:focus-visible{outline:2px solid} .p{max-height:100dvh}";\n';
    expect(checkUserscript(bundle(CODE + css))).toEqual([]);
    const w = compatWarnings(CODE + css).join(' | ');
    expect(w).toMatch(/focus-visible/);
    expect(w).toMatch(/dvh/);
  });

  it.each([
    'name',
    'namespace',
    'version',
    'description',
    'match',
    'run-at',
    'inject-into',
    'noframes',
    'updateURL',
    'downloadURL',
  ])('checkUserscript reports a missing @%s (R-193)', (key) => {
    const b = bundle();
    const metaJs = b.metaJs
      .split('\n')
      .filter((l) => !new RegExp(`^// @${key}(\\s|$)`).test(l))
      .join('\n');
    expect(metaJs).not.toEqual(b.metaJs);
    const errs = checkUserscript({ ...b, metaJs, userJs: metaJs + '\n' + CODE });
    expect(
      errs.some((e: string) => e.includes(`@${key}`)),
      errs.join(' | '),
    ).toBe(true);
  });

  const withMeta = (extra: string) => {
    const b = bundle();
    const metaJs = b.metaJs.replace('// ==/UserScript==', extra + '\n// ==/UserScript==');
    return { ...b, metaJs, userJs: metaJs + '\n' + CODE };
  };

  it.each([
    ['@include', '// @include      *', /unexpected @include/],
    ['@connect', '// @connect      example.invalid', /unexpected @connect/],
    ['@resource', '// @resource     x https://example.invalid/x', /unexpected @resource/],
    ['an extra @match', '// @match        https://*/*', /@match https:\/\/\*\/\* is not allowed/],
    ['a second @run-at', '// @run-at       document-start', /@run-at appears 2×/],
  ])('checkUserscript rejects %s (whitelist, R-193)', (_n, line, re) => {
    const errs = checkUserscript(withMeta(line));
    expect(
      errs.some((e: string) => re.test(e)),
      errs.join(' | '),
    ).toBe(true);
  });

  it('checkUserscript rejects a version that is not SemVer', () => {
    const errs = checkUserscript(bundle(CODE, undefined, '1.2'));
    expect(
      errs.some((e: string) => /SemVer/.test(e)),
      errs.join(' | '),
    ).toBe(true);
  });

  it("platformLeaks finds the other platform's API in a built bundle on token level (artifact level, D-036)", () => {
    expect(platformLeaks('const x = chrome.runtime.id; browser.tabs;', 'userscript')).toEqual(['chrome', 'browser']);
    expect(platformLeaks('chrome?.runtime; const { runtime } = unsafeWindow;', 'userscript')).toEqual([
      'chrome',
      'unsafeWindow',
    ]);
    expect(platformLeaks('GM["getValue"]("a"); const { setValue } = GM; GM_info', 'chrome')).toEqual(['GM', 'GM_info']);
    expect(platformLeaks('const chromeVersion = 1; navigator.userAgent; const GMT = 0', 'userscript')).toEqual([]);
    expect(platformLeaks('const GMT = 0; GMapping()', 'chrome')).toEqual([]);
    // esbuild writes module path comments into unminified bundles – they are no API use
    expect(platformLeaks('  // src/platform/chrome/bridge-main.ts\nfoo();', 'userscript')).toEqual([]);
    expect(platformLeaks('const u = "https://x.invalid/a"; chrome.runtime;', 'userscript')).toEqual(['chrome']);
  });
});
