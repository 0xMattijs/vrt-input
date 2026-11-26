// Message catalogs: every text the components show, and every issue message.
// Node names come from the taxonomy; to show them in another language, pass a
// taxonomy with translated names.
import type { IssueCode, Level, Priority, VrtIssue } from './types';

/** Parameters of each issue code. */
export interface IssueParams {
  TOO_LONG: { max: number };
  INVALID_FORMAT: Record<string, never>;
  TOO_DEEP: Record<string, never>;
  /** `parentName` is `null` for an unknown category. */
  UNKNOWN_ID: { id: string; level: Level; parentName: string | null };
  /** `replacement` is the new dotted ID, or `null` when there's none. */
  DEPRECATED: { id: string; replacement: string | null; replacementName: string | null };
  /** `level` is the level still to choose; `name` is the chosen node's name. */
  INCOMPLETE: { level: Level; name: string };
  NOT_CANONICAL: { normalized: string };
}

/** Every text the components show. */
export interface VrtMessages {
  /** BCP 47 language tag, such as `en` or `nl`. Sets number formatting and the `lang` attribute. */
  locale: string;
  levels: Record<Level, string>;
  priority: {
    /** Label of the priority, such as "Priority". */
    label: string;
    names: Record<Priority, string>;
    /** Shown when the VRT sets no fixed priority. */
    varies: string;
  };
  issues: { [C in IssueCode]: (params: IssueParams[C]) => string };
  ui: {
    /** Default label of the component. */
    label: string;
    /** Text of the menu button when nothing is chosen. */
    placeholder: string;
    /** Accessible name of the filter field. */
    filter: string;
    filterPlaceholder: string;
    /** Screen reader announcement of the number of filter results. */
    results: (count: number) => string;
    noResults: string;
    /** First option of each dropdown when nothing is chosen at that level. */
    choose: Record<Level, string>;
    /** Option that keeps the parent itself, when the parent may be chosen without a child. */
    noSpecific: Record<2 | 3, string>;
    /** Shown in a dropdown that the chosen entry doesn't need. */
    notApplicable: string;
    /** Screen reader text after an entry that has more specific entries, such as ", 6 options". */
    childCount: (count: number) => string;
    useReplacement: (name: string) => string;
    clear: string;
    error: string;
    warning: string;
    /** Separator between names in a path, such as " › ". */
    pathSeparator: string;
    /** The taxonomy version, such as "VRT 1.19.1". */
    taxonomyVersion: (version: string) => string;
  };
}

/** A partial catalog: anything left out comes from the enclosing provider or English. */
export type VrtMessagesInput = {
  locale?: string;
  levels?: Partial<VrtMessages['levels']>;
  priority?: Partial<Omit<VrtMessages['priority'], 'names'>> & { names?: Partial<Record<Priority, string>> };
  issues?: Partial<VrtMessages['issues']>;
  ui?: Partial<VrtMessages['ui']>;
};

const LEVEL_NAMES_EN: Record<Level, string> = { 1: 'category', 2: 'subcategory', 3: 'variant' };

export const en: VrtMessages = {
  locale: 'en',
  levels: { 1: 'Category', 2: 'Subcategory', 3: 'Variant' },
  priority: {
    label: 'Priority',
    names: { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Informational' },
    varies: 'Varies',
  },
  issues: {
    TOO_LONG: (p) => `The ID is longer than ${p.max} characters.`,
    INVALID_FORMAT: () =>
      'A VRT ID is one to three names of lowercase letters, digits, and underscores, separated by dots.',
    TOO_DEEP: () => 'A VRT ID has at most three levels: category, subcategory, and variant.',
    UNKNOWN_ID: (p) =>
      p.parentName === null
        ? `"${p.id}" isn't a VRT category.`
        : `"${p.id}" isn't a ${LEVEL_NAMES_EN[p.level]} of ${p.parentName}.`,
    DEPRECATED: (p) =>
      p.replacementName
        ? `"${p.id}" was removed from the VRT. It was replaced by ${p.replacementName}.`
        : `"${p.id}" was removed from the VRT, with no direct replacement.`,
    INCOMPLETE: (p) => `Choose a ${LEVEL_NAMES_EN[p.level]} of ${p.name}.`,
    NOT_CANONICAL: (p) => `VRT IDs are lowercase, without spaces: ${p.normalized}.`,
  },
  ui: {
    label: 'Vulnerability type',
    placeholder: 'Choose a vulnerability type',
    filter: 'Filter vulnerability types',
    filterPlaceholder: 'Type to filter, such as "stored xss"',
    results: (n) => (n === 1 ? '1 result' : `${n} results`),
    noResults: 'No matching vulnerability types.',
    choose: { 1: 'Choose a category', 2: 'Choose a subcategory', 3: 'Choose a variant' },
    noSpecific: { 2: 'No specific subcategory', 3: 'No specific variant' },
    notApplicable: 'Not applicable',
    childCount: (n) => (n === 1 ? ', 1 option' : `, ${n} options`),
    useReplacement: (name) => `Use ${name}`,
    clear: 'Clear',
    error: 'Error',
    warning: 'Warning',
    pathSeparator: ' › ',
    taxonomyVersion: (v) => `VRT ${v}`,
  },
};

/** Merges a partial catalog over `base`. */
export function resolveMessages(input?: VrtMessagesInput | VrtMessages | null, base: VrtMessages = en): VrtMessages {
  if (!input) return base;
  return {
    locale: input.locale ?? base.locale,
    levels: { ...base.levels, ...input.levels },
    priority: {
      ...base.priority,
      ...input.priority,
      names: { ...base.priority.names, ...input.priority?.names },
    },
    issues: { ...base.issues, ...input.issues } as VrtMessages['issues'],
    ui: { ...base.ui, ...input.ui },
  };
}

/** An issue's message in the catalog's language. */
export function formatIssue(issue: VrtIssue, messages: VrtMessages = en): string {
  const fn = messages.issues[issue.code] as (p: unknown) => string;
  return fn(issue.params);
}

/** A priority as text, such as "P1 Critical" or "Varies". */
export function formatPriority(priority: Priority | 'varies', messages: VrtMessages = en): string {
  return priority === 'varies' ? messages.priority.varies : `P${priority} ${messages.priority.names[priority]}`;
}

/** Builds an issue with its English message. */
export function makeIssue<C extends IssueCode>(
  code: C,
  params: IssueParams[C],
  severity: VrtIssue['severity'] = 'error',
  level?: Level,
): VrtIssue {
  const issue: VrtIssue = { severity, code, params: params as VrtIssue['params'], message: '' };
  if (level) issue.level = level;
  issue.message = formatIssue(issue, en);
  return issue;
}
