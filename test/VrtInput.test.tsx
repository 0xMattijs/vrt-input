import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VrtInput, createTaxonomy } from '../src';

afterEach(cleanup);

const SELF_XSS = 'cross_site_scripting_xss.stored.self';
const trigger = () => screen.getByRole('button', { name: /^Vulnerability type/ });
const column = (name: string) => screen.getByRole('listbox', { name });
const activeOption = (list: HTMLElement) => document.getElementById(list.getAttribute('aria-activedescendant')!)!;

describe('menu', () => {
  it('shows the chosen path in the button', () => {
    render(<VrtInput defaultValue={SELF_XSS} />);
    expect(trigger().textContent).toBe('Cross-Site Scripting (XSS) › Stored › Self');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('chooses an entry by clicking through the columns', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput onChange={onChange} />);
    await user.click(trigger());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    await user.click(within(column('Category')).getByRole('option', { name: /^Cross-Site Scripting \(XSS\)/ }));
    await user.click(within(column('Subcategory')).getByRole('option', { name: /^Stored/ }));
    await user.click(within(column('Variant')).getByRole('option', { name: 'Self' }));
    expect(onChange).toHaveBeenCalledWith(SELF_XSS, expect.objectContaining({ valid: true, priority: 5 }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().textContent).toContain('Self');
  });

  it('chooses an entry with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput onChange={onChange} />);
    trigger().focus();
    await user.keyboard('{ArrowDown}'); // Opens the menu, focus in the filter.
    await user.keyboard('{ArrowDown}'); // Into the category column.
    const categories = column('Category');
    expect(document.activeElement).toBe(categories);
    expect(activeOption(categories).textContent).toMatch(/^AI Application Security/);
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).toBe(column('Subcategory')));
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).toBe(column('Variant')));
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(
      'ai_application_security.adversarial_example_injection.ai_misclassification_attacks',
      expect.anything(),
    );
    expect(document.activeElement).toBe(trigger());
  });

  it('moves back a column with ArrowLeft and keeps the path', async () => {
    const user = userEvent.setup();
    render(<VrtInput defaultValue={SELF_XSS} />);
    await user.click(trigger());
    // The menu opens on the current value.
    expect(activeOption(column('Variant')).textContent).toBe('Self');
    column('Variant').focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(column('Subcategory'));
    expect(activeOption(column('Subcategory')).textContent).toMatch(/^Stored/);
    await user.keyboard('{ArrowDown}');
    // Moving in a column clears the deeper columns.
    expect(screen.queryByRole('listbox', { name: 'Variant' })).toBeNull();
  });

  it('filters and chooses the active result with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput onChange={onChange} />);
    await user.click(trigger());
    await user.keyboard('sql');
    const combobox = screen.getByRole('combobox');
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
    const results = screen.getByRole('listbox');
    expect(activeOption(combobox).textContent).toBe('Server-Side Injection › SQL Injection');
    expect(screen.getByRole('status').textContent).toMatch(/^\d+ results?$/);
    expect(within(results).getAllByRole('option')[0].querySelector('mark')?.textContent).toBe('SQL');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('server_side_injection.sql_injection', expect.anything());
  });

  it('moves through results with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<VrtInput />);
    await user.click(trigger());
    await user.keyboard('xss stored');
    const combobox = screen.getByRole('combobox');
    const first = activeOption(combobox).id;
    await user.keyboard('{ArrowDown}');
    expect(activeOption(combobox).id).not.toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(activeOption(combobox).id).toBe(first);
  });

  it('types into the filter from a column', async () => {
    const user = userEvent.setup();
    render(<VrtInput />);
    await user.click(trigger());
    await user.keyboard('{ArrowDown}s');
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('s');
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<VrtInput />);
    await user.click(trigger());
    await user.keyboard('zzzzqqq');
    expect(screen.getAllByText('No matching vulnerability types.').length).toBeGreaterThan(0);
  });

  it('clears the filter, then closes, with Escape', async () => {
    const user = userEvent.setup();
    render(<VrtInput />);
    await user.click(trigger());
    await user.keyboard('xss');
    await user.keyboard('{Escape}');
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    render(
      <>
        <VrtInput />
        <p>Outside</p>
      </>,
    );
    await user.click(trigger());
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers "No specific" options for nodes that may be chosen with children', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput onChange={onChange} />);
    await user.click(trigger());
    await user.click(within(column('Category')).getByRole('option', { name: /^Server Security Misconfiguration/ }));
    await user.click(within(column('Subcategory')).getByRole('option', { name: /^Fingerprinting\/Banner Disclosure/ }));
    await user.click(within(column('Variant')).getByRole('option', { name: 'No specific variant' }));
    expect(onChange).toHaveBeenCalledWith(
      'server_security_misconfiguration.fingerprinting_banner_disclosure',
      expect.objectContaining({ valid: true }),
    );
  });

  it('allows any level with allowPartial', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput onChange={onChange} allowPartial />);
    await user.click(trigger());
    await user.click(within(column('Category')).getByRole('option', { name: /^Cross-Site Scripting \(XSS\)/ }));
    await user.click(within(column('Subcategory')).getByRole('option', { name: 'No specific subcategory' }));
    expect(onChange).toHaveBeenCalledWith('cross_site_scripting_xss', expect.objectContaining({ valid: true }));
  });

  it('shows priorities when asked', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VrtInput value={SELF_XSS} />);
    expect(screen.queryByText('P5 Informational')).toBeNull();
    rerender(<VrtInput value={SELF_XSS} showPriority />);
    expect(within(trigger()).getByText('P5 Informational')).toBeTruthy();
    await user.click(trigger());
    expect(within(column('Variant')).getAllByText(/^P\d /).length).toBeGreaterThan(0);
  });

  it('clears the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput defaultValue={SELF_XSS} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('', expect.objectContaining({ valid: false }));
    expect(trigger().textContent).toBe('Choose a vulnerability type');
  });

  it("doesn't open when read-only or disabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VrtInput defaultValue={SELF_XSS} readOnly />);
    await user.click(trigger());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    rerender(<VrtInput defaultValue={SELF_XSS} disabled />);
    expect((trigger() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('issues', () => {
  it('shows errors and marks the control invalid', () => {
    render(<VrtInput defaultValue="cross_site_scripting_xss.nope" />);
    expect(screen.getByText(`"nope" isn't a subcategory of Cross-Site Scripting (XSS).`)).toBeTruthy();
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
  });

  it('shows an incomplete choice as a hint, not an error', () => {
    render(<VrtInput defaultValue="cross_site_scripting_xss" />);
    expect(screen.getByText('Choose a subcategory of Cross-Site Scripting (XSS).').className).toBe('vrt-hint');
    expect(trigger().getAttribute('aria-invalid')).toBeNull();
    expect(trigger().textContent).toBe('Cross-Site Scripting (XSS)');
  });

  it('offers the replacement of a deprecated ID', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const t = createTaxonomy(
      { content: [{ id: 'web', name: 'Web', children: [{ id: 'xss', name: 'XSS', priority: 3 }] }] },
      { deprecated: { 'web.cross_site': { '1.0': 'web.xss' } } },
    );
    render(<VrtInput defaultValue="web.cross_site" taxonomy={t} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Use Web › XSS' }));
    expect(onChange).toHaveBeenCalledWith('web.xss', expect.objectContaining({ valid: true }));
  });
});

describe('dropdowns', () => {
  const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement;

  it('shows the value in three dropdowns', () => {
    render(<VrtInput mode="dropdowns" defaultValue={SELF_XSS} />);
    expect(screen.getByRole('group', { name: 'Vulnerability type' })).toBeTruthy();
    expect(select('Category').value).toBe('cross_site_scripting_xss');
    expect(select('Subcategory').value).toBe('stored');
    expect(select('Variant').value).toBe('self');
  });

  it('builds the value one level at a time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput mode="dropdowns" onChange={onChange} />);
    expect(select('Subcategory').disabled).toBe(true);
    await user.selectOptions(select('Category'), 'cross_site_scripting_xss');
    expect(onChange).toHaveBeenLastCalledWith('cross_site_scripting_xss', expect.objectContaining({ valid: false }));
    expect(select('Subcategory').disabled).toBe(false);
    await user.selectOptions(select('Subcategory'), 'stored');
    await user.selectOptions(select('Variant'), 'self');
    expect(onChange).toHaveBeenLastCalledWith(SELF_XSS, expect.objectContaining({ valid: true }));
  });

  it('clears the deeper levels when a higher level changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VrtInput mode="dropdowns" defaultValue={SELF_XSS} onChange={onChange} />);
    await user.selectOptions(select('Subcategory'), 'reflected');
    expect(onChange).toHaveBeenLastCalledWith('cross_site_scripting_xss.reflected', expect.anything());
    expect(select('Variant').value).toBe('');
    await user.selectOptions(select('Category'), '');
    expect(onChange).toHaveBeenLastCalledWith('', expect.anything());
  });

  it('disables a level the entry doesn’t have', () => {
    render(<VrtInput mode="dropdowns" defaultValue="server_side_injection.sql_injection" />);
    expect(select('Variant').disabled).toBe(true);
    expect(select('Variant').selectedOptions[0].textContent).toBe('Not applicable');
  });

  it('shares the value with the menu', async () => {
    const user = userEvent.setup();
    function Both() {
      const [value, setValue] = useState(SELF_XSS);
      return (
        <>
          <VrtInput value={value} onChange={setValue} />
          <VrtInput value={value} onChange={setValue} mode="dropdowns" label="Same value" />
        </>
      );
    }
    render(<Both />);
    await user.selectOptions(select('Subcategory'), 'reflected');
    expect(trigger().textContent).toBe('Cross-Site Scripting (XSS) › Reflected');
    await user.click(trigger());
    await user.keyboard('sql');
    await user.keyboard('{Enter}');
    expect(select('Category').value).toBe('server_side_injection');
    expect(select('Subcategory').value).toBe('sql_injection');
  });

  it('shows the priority when asked', () => {
    render(<VrtInput mode="dropdowns" defaultValue={SELF_XSS} showPriority />);
    expect(screen.getByText('P5 Informational')).toBeTruthy();
  });
});

describe('forms', () => {
  it('submits the normalized ID, or nothing when it is not valid', () => {
    const { container, rerender } = render(<VrtInput name="vrt" value={' ' + SELF_XSS.toUpperCase()} />);
    const hidden = () => container.querySelector('input[type=hidden]') as HTMLInputElement;
    expect(hidden().name).toBe('vrt');
    expect(hidden().value).toBe(SELF_XSS);
    rerender(<VrtInput name="vrt" value="cross_site_scripting_xss" />);
    expect(hidden().value).toBe('');
  });

  it('lets a label element name the control through id', () => {
    render(
      <>
        <VrtInput id="vrt-field" />
        <VrtInput id="vrt-select" mode="dropdowns" />
      </>,
    );
    expect(document.getElementById('vrt-field')?.tagName).toBe('BUTTON');
    expect(document.getElementById('vrt-select')?.tagName).toBe('SELECT');
  });

  it('keeps focus inside when tabbing between filter and columns', () => {
    render(<VrtInput />);
    fireEvent.click(trigger());
    const combobox = screen.getByRole('combobox');
    fireEvent.blur(combobox, { relatedTarget: column('Category') });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.blur(combobox, { relatedTarget: document.body });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
