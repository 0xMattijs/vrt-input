import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { VrtInput, nl } from '../src';

afterEach(cleanup);

const SELF_XSS = 'cross_site_scripting_xss.stored.self';

/** Runs axe on what's rendered. jsdom has no layout, so color contrast is tested separately. */
async function violations(container: Element) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

const mount = (ui: ReactElement) => render(<main>{ui}</main>).container;

describe('axe', () => {
  const cases: Array<[string, ReactElement]> = [
    ['empty menu', <VrtInput />],
    ['chosen entry with priority', <VrtInput defaultValue={SELF_XSS} showPriority />],
    ['incomplete', <VrtInput defaultValue="cross_site_scripting_xss" />],
    ['unknown ID', <VrtInput defaultValue="cross_site_scripting_xss.nope" />],
    ['deprecated ID', <VrtInput defaultValue="social_engineering" />],
    ['not canonical', <VrtInput defaultValue={SELF_XSS.toUpperCase()} />],
    ['read-only', <VrtInput defaultValue={SELF_XSS} readOnly />],
    ['disabled', <VrtInput defaultValue={SELF_XSS} disabled />],
    ['dropdowns, empty', <VrtInput mode="dropdowns" />],
    ['dropdowns, chosen with priority', <VrtInput mode="dropdowns" defaultValue={SELF_XSS} showPriority />],
    ['dropdowns, no variants', <VrtInput mode="dropdowns" defaultValue="server_side_injection.sql_injection" />],
    ['dropdowns, error', <VrtInput mode="dropdowns" defaultValue="nope" />],
    ['dropdowns, disabled', <VrtInput mode="dropdowns" defaultValue={SELF_XSS} disabled />],
    ['Dutch', <VrtInput defaultValue="nope" messages={nl} />],
    [
      'two inputs on one page',
      <>
        <VrtInput defaultValue={SELF_XSS} />
        <VrtInput mode="dropdowns" label="Second" />
      </>,
    ],
  ];

  it.each(cases)('%s has no violations', async (_, ui) => {
    expect(await violations(mount(ui))).toEqual([]);
  });

  it('open menu, browsing columns, has no violations', async () => {
    const user = userEvent.setup();
    const container = mount(<VrtInput defaultValue={SELF_XSS} showPriority />);
    await user.click(screen.getByRole('button', { name: /^Vulnerability type/ }));
    expect(await violations(container)).toEqual([]);
  });

  it('open menu, filtering, has no violations', async () => {
    const user = userEvent.setup();
    const container = mount(<VrtInput showPriority />);
    await user.click(screen.getByRole('button', { name: /^Vulnerability type/ }));
    await user.keyboard('xss');
    expect(await violations(container)).toEqual([]);
    await user.keyboard('zzzz');
    expect(await violations(container)).toEqual([]);
  });
});

describe('screen reader support', () => {
  it('names the button with the label and the value', () => {
    render(<VrtInput defaultValue={SELF_XSS} />);
    const button = screen.getByRole('button', { name: /^Vulnerability type/ });
    const name = button
      .getAttribute('aria-labelledby')!
      .split(' ')
      .map((id) => document.getElementById(id)!.textContent)
      .join(' ');
    expect(name).toBe('Vulnerability type Cross-Site Scripting (XSS) › Stored › Self');
  });

  it('says how many entries an option opens', async () => {
    const user = userEvent.setup();
    render(<VrtInput />);
    await user.click(screen.getByRole('button', { name: /^Vulnerability type/ }));
    expect(screen.getByRole('option', { name: /^Cross-Site Scripting \(XSS\), \d+ options$/ })).toBeTruthy();
  });

  it('links issues to the control', () => {
    render(<VrtInput defaultValue="nope" />);
    const button = screen.getByRole('button', { name: /^Vulnerability type/ });
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(
      `Error: "nope" isn't a VRT category.`,
    );
  });
});
