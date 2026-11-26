// @vitest-environment node
// Checks WCAG 2.2 AA contrast for the color tokens in styles.css, in light and dark mode.
// Text needs 4.5:1; UI component boundaries and focus indicators need 3:1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/react/styles.css', import.meta.url), 'utf8');

function tokens(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--vrt-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens('.vrt {');
const dark = { ...light, ...tokens(":root[data-theme='dark'] .vrt {") };

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** A color drawn with opacity over a background. */
function blend(fg: string, bg: string, alpha: number): [number, number, number] {
  const f = rgb(fg);
  const b = rgb(bg);
  return [0, 1, 2].map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha))) as [number, number, number];
}

type Pair = [name: string, fg: string, bg: string, min: number, alpha?: number];

const TEXT = 4.5;
const UI = 3;

const pairs: Pair[] = [
  ['text on background', 'text', 'bg', TEXT],
  ['text on surface', 'text', 'surface', TEXT],
  ['muted text on background', 'text-muted', 'bg', TEXT],
  ['muted text on surface', 'text-muted', 'surface', TEXT],
  ['text on the active option', 'text', 'active-bg', TEXT],
  ['ancestor names on the active result', 'text-muted', 'active-bg', TEXT],
  ['highlighted match', 'text', 'mark-bg', TEXT],
  ['error message', 'error', 'error-bg', TEXT],
  ['warning message', 'warning', 'warning-bg', TEXT],
  ['priority P1', 'p1', 'bg', TEXT],
  ['priority P2', 'p2', 'bg', TEXT],
  ['priority P3', 'p3', 'bg', TEXT],
  ['priority P4', 'p4', 'bg', TEXT],
  ['priority P5', 'p5', 'bg', TEXT],
  ['priority Varies', 'varies', 'bg', TEXT],
  ['control borders', 'border-strong', 'bg', UI],
  ['selection bar on a column', 'accent', 'surface', UI],
  ['active option outline', 'accent', 'active-bg', UI],
  ['focus outline', 'focus', 'bg', UI],
  ['invalid control border', 'error', 'bg', UI],
];

for (const [mode, t] of [['light', light], ['dark', dark]] as const) {
  describe(`${mode} mode contrast`, () => {
    it.each(pairs)('%s', (_, fg, bg, min, alpha) => {
      expect(t[fg], `missing token ${fg}`).toBeDefined();
      expect(t[bg], `missing token ${bg}`).toBeDefined();
      const ratio = contrast(alpha ? blend(t[fg], t[bg], alpha) : rgb(t[fg]), rgb(t[bg]));
      expect(Number(ratio.toFixed(2)), `${t[fg]} on ${t[bg]}`).toBeGreaterThanOrEqual(min);
    });
  });
}

it('uses the same dark tokens for prefers-color-scheme and data-theme', () => {
  expect(tokens(":root:not([data-theme='light']) .vrt {")).toEqual(tokens(":root[data-theme='dark'] .vrt {"));
});
