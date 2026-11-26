import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VrtInput, VrtMessagesProvider, en, evaluate, formatIssue, formatPriority, nl, resolveMessages } from '../src';
import type { IssueCode, VrtIssue } from '../src';

afterEach(cleanup);

/** Inputs that between them produce every issue code. */
function everyIssue(): VrtIssue[] {
  return [
    'x'.repeat(300),
    'A B',
    'a.b.c.d',
    'nope',
    'cross_site_scripting_xss.nope',
    'social_engineering',
    'cross_site_scripting_xss',
    ' cross_site_scripting_xss.stored.self',
  ].flatMap((v) => evaluate(v).issues);
}

describe('catalogs', () => {
  it('covers every issue code', () => {
    const codes = new Set(everyIssue().map((i) => i.code));
    const all: IssueCode[] = ['TOO_LONG', 'INVALID_FORMAT', 'TOO_DEEP', 'UNKNOWN_ID', 'DEPRECATED', 'INCOMPLETE', 'NOT_CANONICAL'];
    expect([...codes].sort()).toEqual([...all].sort());
  });

  it('has a Dutch text for everything English has', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(keys(nl).sort()).toEqual(keys(en).sort());
    for (const issue of everyIssue()) {
      const text = formatIssue(issue, nl);
      expect(text).not.toBe(issue.message);
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('keeps issue.message in English', () => {
    expect(evaluate('nope').issues[0].message).toBe(`"nope" isn't a VRT category.`);
    expect(formatIssue(evaluate('nope').issues[0], nl)).toBe('"nope" is geen VRT-categorie.');
  });

  it('formats priorities', () => {
    expect(formatPriority(1)).toBe('P1 Critical');
    expect(formatPriority('varies', nl)).toBe('Varieert');
    expect(formatPriority(3, resolveMessages({ priority: { names: { 3: 'Moderate' } } }))).toBe('P3 Moderate');
  });
});

describe('components', () => {
  it('uses the provider language and sets lang', () => {
    const { container } = render(
      <VrtMessagesProvider messages={nl}>
        <VrtInput mode="dropdowns" />
      </VrtMessagesProvider>,
    );
    expect(container.querySelector('.vrt')?.getAttribute('lang')).toBe('nl');
    expect(screen.getByRole('group', { name: 'Type kwetsbaarheid' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Categorie' })).toBeTruthy();
  });

  it('lets a partial catalog override single texts', () => {
    render(
      <VrtMessagesProvider messages={nl}>
        <VrtInput messages={{ ui: { label: 'Soort bevinding' } }} />
      </VrtMessagesProvider>,
    );
    expect(screen.getByRole('button', { name: /^Soort bevinding Kies een type kwetsbaarheid$/ })).toBeTruthy();
  });
});
