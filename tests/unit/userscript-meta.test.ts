import { describe, expect, it } from 'vitest';
import {
  ALLOWED_GM,
  NO_GRANT_NEEDED,
  RAW_BASE,
  buildMeta,
  checkUserscript,
  toTemplateLiteral,
  usedGmApis,
} from '../../scripts/userscript-meta.mjs';

const V = '1.2.3';
const CODE =
  "(() => {\n  if (typeof GM !== 'undefined') GM.setValue('a', '1');\n  void GM.getValue('a');\n  void GM.info;\n})();\n";

function bundle(code = CODE, grants = ['GM.getValue', 'GM.setValue'], version = V) {
  const metaJs = buildMeta({ version, description: 'd', grants });
  return { metaJs, userJs: metaJs + '\n' + code, version: V };
}

describe('userscript metadata + bundle check (R-103–R-105, R-107, R-192, R-193)', () => {
  it('ALLOWED_GM is exactly the R-099 intersection; GM.info needs no grant', () => {
    expect([...ALLOWED_GM].sort()).toEqual(
      ['addStyle', 'deleteValue', 'getValue', 'info', 'listValues', 'setClipboard', 'setValue'].sort(),
    );
    expect(NO_GRANT_NEEDED).toEqual(['info']);
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
  ])('checkUserscript flags %s', (_name, make, re) => {
    const errs = checkUserscript(make());
    expect(
      errs.some((e: string) => re.test(e)),
      errs.join(' | '),
    ).toBe(true);
  });
});
