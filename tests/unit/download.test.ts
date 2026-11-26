/** P3b T6 (R-006): the run export is offered as a file download – DOM only, no extension permission. */
import { describe, expect, it } from 'vitest';
import { downloadText } from '../../src/ui/download';
import { loadFixture } from './helpers';

describe('downloadText', () => {
  it('clicks a temporary <a download> with a blob URL and removes it again', () => {
    const doc = loadFixture('title');
    const seen: { download: string; href: string }[] = [];
    doc.addEventListener('click', (e) => {
      const a = e.target as HTMLAnchorElement;
      seen.push({ download: a.download, href: a.href });
      e.preventDefault();
    });
    expect(downloadText(doc, 'pkbot-runs-20261126-201530.json', '{"format":"pkbot-runs/1"}')).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.download).toBe('pkbot-runs-20261126-201530.json');
    expect(seen[0]!.href).toMatch(/^blob:/);
    expect(doc.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('returns false when the browser cannot create blob URLs (the caller copies instead)', () => {
    const doc = loadFixture('title');
    const view = doc.defaultView as unknown as { URL: { createObjectURL?: unknown } };
    view.URL = { createObjectURL: undefined };
    expect(downloadText(doc, 'x.json', '{}')).toBe(false);
  });
});
