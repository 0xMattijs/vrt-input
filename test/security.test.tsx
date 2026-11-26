import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { VrtInput, createTaxonomy, evaluate } from '../src';

afterEach(cleanup);

const PAYLOAD = '<img src=x onerror="window.__pwned=1">';

describe('untrusted text', () => {
  it('renders taxonomy names as text', async () => {
    const user = userEvent.setup();
    const t = createTaxonomy({ content: [{ id: 'evil', name: PAYLOAD, priority: 1 }] });
    const { container } = render(<VrtInput taxonomy={t} defaultValue="evil" showPriority />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp('^Vulnerability type') }).textContent).toContain(PAYLOAD);
    await user.click(screen.getByRole('button', { name: /^Vulnerability type/ }));
    await user.keyboard('img');
    expect(container.querySelector('img')).toBeNull();
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('rejects markup in the value before looking it up', () => {
    const r = evaluate(PAYLOAD);
    expect(r.issues.map((i) => i.code)).toEqual(['INVALID_FORMAT']);
    // The message doesn't quote the input, so it can't carry markup.
    expect(r.issues[0].message).not.toContain('<');
  });

  it('only quotes IDs that match the ID pattern', () => {
    for (const issue of evaluate('cross_site_scripting_xss.evil_ID').issues) {
      expect(issue.message).toMatch(/^[^<>&]*$/);
    }
  });

  it('caps input length', () => {
    const r = evaluate('a'.repeat(1_000_000));
    expect(r.issues.map((i) => i.code)).toEqual(['TOO_LONG']);
  });

  it('caps the size of a custom taxonomy', () => {
    const content = Array.from({ length: 10_001 }, (_, i) => ({ id: `n${i}`, name: 'N', priority: 5 }));
    expect(() => createTaxonomy({ content })).toThrow(/more than 10000 nodes/);
  });

  it('only submits a normalized ID from the hidden field', () => {
    const { container } = render(<VrtInput name="vrt" defaultValue={PAYLOAD} />);
    expect((container.querySelector('input[type=hidden]') as HTMLInputElement).value).toBe('');
  });
});
