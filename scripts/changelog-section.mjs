// Prints the CHANGELOG.md entry for one version, without its heading.
//
// Usage:
//   node scripts/changelog-section.mjs <version>          # entry may be undated
//   node scripts/changelog-section.mjs <version> --dated  # entry must have a release date
//
// Exits with an error if the entry is missing or empty, or, with --dated, has no date.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Returns { date, body } for the version, or throws with a message for the release log. */
export function changelogSection(text, version, { dated = false } = {}) {
  const lines = text.split('\n');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[${escaped}\\](?: - (.+))?\\s*$`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) throw new Error(`CHANGELOG.md has no entry for ${version}. Add "## [${version}] - YYYY-MM-DD".`);
  const date = heading.exec(lines[start])[1]?.trim() ?? null;
  if (dated && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    throw new Error(`The CHANGELOG.md entry for ${version} has no release date. Use "## [${version}] - YYYY-MM-DD".`);
  }
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  if (!body) throw new Error(`The CHANGELOG.md entry for ${version} is empty.`);
  return { date, body };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node scripts/changelog-section.mjs <version> [--dated]');
    process.exit(2);
  }
  try {
    const text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    console.log(changelogSection(text, version, { dated: process.argv.includes('--dated') }).body);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
