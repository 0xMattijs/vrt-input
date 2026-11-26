import { makeIssue } from './messages';
import { ID_PATTERN, vrt } from './taxonomy';
import type { EvaluateOptions, Level, VrtIssue, VrtNode, VrtResult } from './types';

export const DEFAULT_MAX_LENGTH = 256;

/**
 * Checks a dotted VRT ID, such as `cross_site_scripting_xss.stored`, against a
 * taxonomy, and returns the node it names, its path, and its priority.
 */
export function evaluate(input: string, options: EvaluateOptions = {}): VrtResult {
  const taxonomy = options.taxonomy ?? vrt;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const raw = typeof input === 'string' ? input : '';
  const issues: VrtIssue[] = [];
  const path: VrtNode[] = [];
  const result = (node: VrtNode | null, normalized: string | null): VrtResult => {
    const valid = node !== null && !issues.some((i) => i.severity === 'error');
    return {
      input: raw,
      valid,
      normalized: valid ? normalized : null,
      node,
      path,
      priority: valid ? node!.priority : null,
      issues,
      taxonomyVersion: taxonomy.version,
    };
  };

  if (raw.length > maxLength) {
    issues.push(makeIssue('TOO_LONG', { max: maxLength }));
    return result(null, null);
  }
  const canonical = raw.trim().toLowerCase().replace(/\s*\.\s*/g, '.');
  if (!canonical) return result(null, null);

  const parts = canonical.split('.');
  if (!parts.every((p) => ID_PATTERN.test(p))) {
    issues.push(makeIssue('INVALID_FORMAT', {}));
    return result(null, null);
  }
  if (parts.length > 3) {
    issues.push(makeIssue('TOO_DEEP', {}));
    return result(null, null);
  }

  if (!taxonomy.get(canonical)) {
    const replacement = taxonomy.replacement(canonical);
    if (replacement !== undefined) {
      const target = replacement === null ? undefined : taxonomy.get(replacement);
      issues.push(
        makeIssue('DEPRECATED', {
          id: canonical,
          replacement,
          replacementName: target ? pathName(target) : null,
        }),
      );
      return result(null, null);
    }
  }

  let node: VrtNode | null = null;
  for (let i = 0; i < parts.length; i++) {
    const next = taxonomy.get(parts.slice(0, i + 1).join('.'));
    if (!next) {
      const level = (i + 1) as Level;
      issues.push(makeIssue('UNKNOWN_ID', { id: parts[i], level, parentName: node?.name ?? null }, 'error', level));
      return result(null, null);
    }
    node = next;
    path.push(next);
  }

  if (node && !node.selectable && !options.allowPartial) {
    const level = (node.level + 1) as Level;
    issues.push(makeIssue('INCOMPLETE', { level, name: node.name }, 'error', level));
  }
  if (canonical !== raw) issues.push(makeIssue('NOT_CANONICAL', { normalized: canonical }, 'warning'));
  return result(node, canonical);
}

/** A node's names from the category down, such as "Cross-Site Scripting (XSS) › Stored". */
export function pathName(node: VrtNode, separator = ' › '): string {
  const names: string[] = [];
  for (let n: VrtNode | null = node; n; n = n.parent) names.unshift(n.name);
  return names.join(separator);
}
