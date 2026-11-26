/** A VRT priority: P1 (most severe) to P5. */
export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * A node's priority. `'varies'` means the VRT sets no fixed priority (`null` in the
 * JSON): the program decides per report. `null` means the node has no priority of its
 * own, such as a category whose entries each have one.
 */
export type NodePriority = Priority | 'varies' | null;

/** The level of a node: 1 for a category, 2 for a subcategory, 3 for a variant. */
export type Level = 1 | 2 | 3;

/** One node in the VRT JSON format, as in bugcrowd/vulnerability-rating-taxonomy. */
export interface VrtSourceNode {
  id: string;
  name: string;
  /** 1–5, or `null` for "varies". Leave it out on a node that has no priority of its own. */
  priority?: number | null;
  children?: VrtSourceNode[];
  /** Ignored: the level follows from the depth. Present in Bugcrowd's files. */
  type?: string;
}

/** A taxonomy in the VRT JSON format. */
export interface VrtSource {
  content: VrtSourceNode[];
  /** Taxonomy version, such as `1.19.1`. */
  version?: string | null;
  /** Release date, such as `2026-07-08`. */
  releaseDate?: string | null;
  /** Bugcrowd's files keep the release date here. */
  metadata?: { release_date?: string | null };
}

/** A node in an indexed taxonomy. */
export interface VrtNode {
  /** The node's own ID, such as `stored`. */
  id: string;
  /** The dotted ID from the category down, such as `cross_site_scripting_xss.stored`. */
  fullId: string;
  name: string;
  level: Level;
  priority: NodePriority;
  /**
   * True when the node can be the value without `allowPartial`: it has no children, or
   * it has a priority of its own (including "varies") next to its children.
   */
  selectable: boolean;
  parent: VrtNode | null;
  children: VrtNode[];
}

/** An indexed taxonomy. Create it once with `createTaxonomy`, outside render. */
export interface Taxonomy {
  version: string | null;
  releaseDate: string | null;
  categories: VrtNode[];
  /** Every node, depth first in taxonomy order. */
  nodes: VrtNode[];
  /** Looks up a node by its dotted ID. */
  get(fullId: string): VrtNode | undefined;
  /**
   * Replacement for a removed ID: the dotted ID of the current node, or `null` when
   * the ID was removed without a direct replacement. `undefined` when the ID was never
   * deprecated.
   */
  replacement(fullId: string): string | null | undefined;
}

export type IssueCode =
  | 'TOO_LONG'
  | 'INVALID_FORMAT'
  | 'TOO_DEEP'
  | 'UNKNOWN_ID'
  | 'DEPRECATED'
  | 'INCOMPLETE'
  | 'NOT_CANONICAL';

export interface VrtIssue {
  severity: 'error' | 'warning';
  code: IssueCode;
  /** English message, for logs and APIs. Use `formatIssue` for other languages. */
  message: string;
  /** Values the message is built from. */
  params: Record<string, string | number | null>;
  /** The level the issue is about, where one applies. */
  level?: Level;
}

export interface VrtResult {
  /** The input as given. */
  input: string;
  /** True when the value names a node that may be chosen, with no errors. */
  valid: boolean;
  /** The canonical ID: trimmed and lowercase. `null` when the input has errors. */
  normalized: string | null;
  /** The node the value names, or `null`. */
  node: VrtNode | null;
  /** The nodes from the category down to `node`, or to the last level that resolved. */
  path: VrtNode[];
  /** Priority of `node`. `null` when the value isn't valid or the node has none. */
  priority: NodePriority;
  issues: VrtIssue[];
  /** Version of the taxonomy the value was checked against. */
  taxonomyVersion: string | null;
}

export interface EvaluateOptions {
  /** Default: the bundled VRT. */
  taxonomy?: Taxonomy;
  /** Accept a category or subcategory that has more specific entries. Default: false. */
  allowPartial?: boolean;
  /** Longest accepted input. Default: 256. */
  maxLength?: number;
}

export interface SearchMatch {
  node: VrtNode;
  /** Matched character ranges in the names along the path, for highlighting. */
  ranges: Array<{ level: Level; start: number; end: number }>;
}

export interface SearchOptions {
  /** Default: the bundled VRT. */
  taxonomy?: Taxonomy;
  /** Also return nodes that aren't selectable. Default: false. */
  allowPartial?: boolean;
  /** Most results returned. Default: 50. */
  limit?: number;
}
