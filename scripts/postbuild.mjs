// Marks the React entry as a client module (Next.js App Router) and copies the stylesheet.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

for (const file of ['dist/index.js', 'dist/index.cjs']) {
  const code = readFileSync(file, 'utf8');
  if (!code.startsWith('"use client"')) writeFileSync(file, `"use client";\n${code}`);
}
copyFileSync('src/react/styles.css', 'dist/styles.css');
