import { describe, expect, it } from 'vitest';
import { ID_PATTERN, createTaxonomy, evaluate, pathName, search, vrt } from '../src/core';
import { VRT_DEPRECATED } from '../src/core/data/vrt';
import type { VrtSource } from '../src/core';

const SELF_XSS = 'cross_site_scripting_xss.stored.self';

describe('bundled taxonomy', () => {
  it('is VRT 1.19.1', () => {
    expect(vrt.version).toBe('1.19.1');
    expect(vrt.releaseDate).toBe('2026-07-08');
    expect(vrt.categories.length).toBe(37);
  });

  it('has valid IDs, three levels at most, and a priority on every leaf', () => {
    for (const node of vrt.nodes) {
      expect(node.id).toMatch(ID_PATTERN);
      expect(node.level).toBeLessThanOrEqual(3);
      if (!node.children.length) expect(node.priority, node.fullId).not.toBeNull();
    }
  });

  it('resolves every deprecated ID to a current node or to no replacement', () => {
    for (const oldId of Object.keys(VRT_DEPRECATED)) {
      const target = vrt.replacement(oldId);
      if (vrt.get(oldId)) expect(target).toBeUndefined();
      else if (target !== null) expect(vrt.get(target!), `${oldId} → ${target}`).toBeDefined();
    }
  });
});

describe('evaluate', () => {
  it('accepts a variant and returns its path and priority', () => {
    const r = evaluate(SELF_XSS);
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe(SELF_XSS);
    expect(r.path.map((n) => n.id)).toEqual(['cross_site_scripting_xss', 'stored', 'self']);
    expect(r.priority).toBe(5);
    expect(r.issues).toEqual([]);
    expect(r.taxonomyVersion).toBe('1.19.1');
  });

  it('treats an empty value as not valid, without issues', () => {
    for (const v of ['', '   ']) expect(evaluate(v)).toMatchObject({ valid: false, issues: [], node: null });
  });

  it('asks for a more specific entry unless allowPartial is set', () => {
    const r = evaluate('cross_site_scripting_xss.stored');
    expect(r.valid).toBe(false);
    expect(r.issues).toMatchObject([{ code: 'INCOMPLETE', level: 3, message: 'Choose a variant of Stored.' }]);
    expect(r.path.length).toBe(2);
    const partial = evaluate('cross_site_scripting_xss.stored', { allowPartial: true });
    expect(partial).toMatchObject({ valid: true, normalized: 'cross_site_scripting_xss.stored', priority: null });
  });

  it('accepts a node with children that has a priority of its own', () => {
    const id = 'server_security_misconfiguration.fingerprinting_banner_disclosure';
    expect(evaluate(id)).toMatchObject({ valid: true, priority: 5 });
  });

  it('accepts a category without children, whose priority varies', () => {
    expect(evaluate('indicators_of_compromise')).toMatchObject({ valid: true, priority: 'varies' });
  });

  it('names the level that is unknown', () => {
    expect(evaluate('nope').issues).toMatchObject([{ code: 'UNKNOWN_ID', level: 1, message: `"nope" isn't a VRT category.` }]);
    const r = evaluate('cross_site_scripting_xss.nope');
    expect(r.issues[0].message).toBe(`"nope" isn't a subcategory of Cross-Site Scripting (XSS).`);
    expect(r.path.map((n) => n.id)).toEqual(['cross_site_scripting_xss']);
  });

  it('reports deprecated IDs with their replacement', () => {
    const replaced = Object.keys(VRT_DEPRECATED).find((id) => vrt.replacement(id));
    expect(replaced).toBeDefined();
    const target = vrt.get(vrt.replacement(replaced!)!)!;
    expect(evaluate(replaced!).issues).toMatchObject([
      { code: 'DEPRECATED', params: { replacement: target.fullId, replacementName: pathName(target) } },
    ]);
    expect(evaluate('social_engineering').issues).toMatchObject([
      { code: 'DEPRECATED', params: { replacement: null }, message: expect.stringContaining('no direct replacement') },
    ]);
  });

  it('normalizes case and spaces with a warning', () => {
    const r = evaluate('  Cross_Site_Scripting_XSS . Stored . Self ');
    expect(r).toMatchObject({ valid: true, normalized: SELF_XSS });
    expect(r.issues).toMatchObject([{ severity: 'warning', code: 'NOT_CANONICAL' }]);
  });

  it('rejects malformed input without looking it up', () => {
    expect(evaluate('a b').issues[0].code).toBe('INVALID_FORMAT');
    expect(evaluate('a..b').issues[0].code).toBe('INVALID_FORMAT');
    expect(evaluate('<img src=x>').issues[0].code).toBe('INVALID_FORMAT');
    expect(evaluate('a.b.c.d').issues[0].code).toBe('TOO_DEEP');
    expect(evaluate('x'.repeat(257)).issues).toMatchObject([{ code: 'TOO_LONG', params: { max: 256 } }]);
    expect(evaluate('x'.repeat(20), { maxLength: 10 }).issues[0].code).toBe('TOO_LONG');
    expect(evaluate(undefined as unknown as string)).toMatchObject({ valid: false, issues: [] });
  });

  it("doesn't treat Object.prototype names as IDs", () => {
    for (const v of ['constructor', '__proto__', 'tostring']) expect(evaluate(v).valid).toBe(false);
  });
});

describe('createTaxonomy', () => {
  const source: VrtSource = {
    version: '2.0',
    content: [
      {
        id: 'web',
        name: 'Web',
        children: [
          { id: 'xss', name: 'Cross-site scripting', priority: 3 },
          { id: 'misc', name: 'Miscellaneous', priority: null, children: [{ id: 'other', name: 'Other', priority: 5 }] },
        ],
      },
    ],
  };

  it('indexes a custom taxonomy', () => {
    const t = createTaxonomy(source);
    expect(t.version).toBe('2.0');
    expect(t.nodes.map((n) => n.fullId)).toEqual(['web', 'web.xss', 'web.misc', 'web.misc.other']);
    expect(evaluate('web.xss', { taxonomy: t })).toMatchObject({ valid: true, priority: 3 });
    expect(evaluate('web.misc', { taxonomy: t })).toMatchObject({ valid: true, priority: 'varies' });
    expect(evaluate('web', { taxonomy: t }).issues[0].code).toBe('INCOMPLETE');
    expect(search('other', { taxonomy: t }).map((m) => m.node.fullId)).toEqual(['web.misc.other']);
  });

  it('reads the release date from Bugcrowd metadata', () => {
    expect(createTaxonomy({ metadata: { release_date: '2026-07-08T00:00:00+00:00' }, content: [] }).releaseDate).toBe(
      '2026-07-08',
    );
  });

  it('follows chains of renames to the newest replacement', () => {
    const t = createTaxonomy(source, {
      deprecated: { 'old.a': { '1.0': 'old.b' }, 'old.b': { '1.1': 'web.xss' }, 'web.xss': { '0.9': 'web' } },
    });
    expect(t.replacement('old.a')).toBe('web.xss');
    expect(t.replacement('old.b')).toBe('web.xss');
    expect(t.replacement('web.xss')).toBeUndefined(); // Current again.
  });

  it.each<[string, VrtSource, RegExp]>([
    ['no content', {} as VrtSource, /content/],
    ['bad id', { content: [{ id: 'Web', name: 'Web' }] }, /content\[0\].*id/],
    ['duplicate id', { content: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }, /at a: duplicate/],
    ['empty name', { content: [{ id: 'a', name: ' ' }] }, /name/],
    ['bad priority', { content: [{ id: 'a', name: 'A', priority: 6 }] }, /priority/],
    [
      'four levels',
      { content: [{ id: 'a', name: 'A', children: [{ id: 'b', name: 'B', children: [{ id: 'c', name: 'C', children: [{ id: 'd', name: 'D' }] }] }] }] },
      /a\.b\.c: a variant cannot have children/,
    ],
  ])('rejects %s', (_, bad, message) => {
    expect(() => createTaxonomy(bad)).toThrow(message);
  });
});

describe('search', () => {
  const ids = (q: string, limit = 5) => search(q, { limit }).map((m) => m.node.fullId);

  it('needs every word, in any order', () => {
    const results = search('xss stored', { limit: 100 });
    expect(results.length).toBeGreaterThan(0);
    for (const m of results) expect(m.node.fullId).toMatch(/^cross_site_scripting_xss\.stored\./);
  });

  it('matches IDs as well as names', () => {
    expect(ids('idor')[0]).toMatch(/^broken_access_control\.idor\./);
  });

  it('ranks matches in the entry name first', () => {
    expect(ids('sql')[0]).toBe('server_side_injection.sql_injection');
  });

  it('returns highlight ranges per level', () => {
    const [m] = search('sql', { limit: 1 });
    expect(m.ranges).toEqual([{ level: 2, start: 0, end: 3 }]);
    expect(m.node.name.slice(0, 3)).toBe('SQL');
  });

  it('only returns entries that may be chosen, unless allowPartial is set', () => {
    expect(ids('stored', 100)).not.toContain('cross_site_scripting_xss.stored');
    expect(search('stored', { allowPartial: true, limit: 100 }).map((m) => m.node.fullId)).toContain(
      'cross_site_scripting_xss.stored',
    );
  });

  it('returns nothing for an empty query and caps long queries', () => {
    expect(search('   ')).toEqual([]);
    expect(() => search('a '.repeat(10_000))).not.toThrow();
  });
});
