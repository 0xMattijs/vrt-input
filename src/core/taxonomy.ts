import { VRT_DATA, VRT_DEPRECATED } from './data/vrt';
import type { Level, NodePriority, Taxonomy, VrtNode, VrtSource, VrtSourceNode } from './types';

/** The pattern of one level of a VRT ID. */
export const ID_PATTERN = /^[a-z0-9_]{1,100}$/;
const MAX_NODES = 10_000;
const MAX_NAME = 200;

export interface CreateTaxonomyOptions {
  /**
   * Removed IDs and their replacements, in the format of Bugcrowd's
   * `deprecated-node-mapping.json`: `{ oldId: { version: newId } }`. The newest
   * version's entry wins.
   */
  deprecated?: Record<string, Record<string, string>>;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function fail(where: string, problem: string): never {
  throw new TypeError(`Invalid taxonomy at ${where}: ${problem}`);
}

/**
 * Checks and indexes a taxonomy in the VRT JSON format. Throws a `TypeError` that
 * names the bad node when the data is malformed.
 */
export function createTaxonomy(source: VrtSource, options: CreateTaxonomyOptions = {}): Taxonomy {
  if (!source || !Array.isArray(source.content)) fail('root', '`content` must be an array');
  const nodes: VrtNode[] = [];
  const index = new Map<string, VrtNode>();

  const build = (raw: VrtSourceNode, parent: VrtNode | null, level: Level, where: string): VrtNode => {
    if (!raw || typeof raw !== 'object') fail(where, 'not an object');
    if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
      fail(where, 'id must be 1–100 characters of a–z, 0–9, and _');
    }
    const fullId = parent ? `${parent.fullId}.${raw.id}` : raw.id;
    where = fullId;
    if (index.has(fullId)) fail(where, 'duplicate id');
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > MAX_NAME) {
      fail(where, `name must be a non-empty string of at most ${MAX_NAME} characters`);
    }
    let priority: NodePriority = null;
    const hasPriority = 'priority' in raw && raw.priority !== undefined;
    if (hasPriority) {
      if (raw.priority === null) priority = 'varies';
      else if (Number.isInteger(raw.priority) && raw.priority! >= 1 && raw.priority! <= 5) {
        priority = raw.priority as NodePriority;
      } else fail(where, 'priority must be 1–5 or null');
    }
    if (raw.children !== undefined && !Array.isArray(raw.children)) fail(where, '`children` must be an array');
    const rawChildren = raw.children ?? [];
    if (rawChildren.length && level === 3) fail(where, 'a variant cannot have children');
    if (nodes.length >= MAX_NODES) fail(where, `more than ${MAX_NODES} nodes`);

    const node: VrtNode = {
      id: raw.id,
      fullId,
      name: raw.name.trim(),
      level,
      priority,
      selectable: rawChildren.length === 0 || hasPriority,
      parent,
      children: [],
    };
    nodes.push(node);
    index.set(fullId, node);
    node.children = rawChildren.map((c, i) => build(c, node, (level + 1) as Level, `${fullId}.children[${i}]`));
    return node;
  };

  const categories = source.content.map((c, i) => build(c, null, 1, `content[${i}]`));

  // Resolve each removed ID to its newest replacement, following chains of renames.
  const direct = new Map<string, string>();
  for (const [oldId, versions] of Object.entries(options.deprecated ?? {})) {
    if (!versions || typeof versions !== 'object') continue;
    const newest = Object.keys(versions).sort(compareVersions).at(-1);
    if (newest && typeof versions[newest] === 'string') direct.set(oldId, versions[newest]);
  }
  const replacements = new Map<string, string | null>();
  for (const oldId of direct.keys()) {
    if (index.has(oldId)) continue; // Re-added later: it's current again.
    let target: string | undefined = direct.get(oldId);
    for (let hops = 0; target && !index.has(target) && direct.has(target) && hops < 20; hops++) {
      target = direct.get(target);
    }
    replacements.set(oldId, target && index.has(target) ? target : null);
  }

  return {
    version: source.version ?? null,
    releaseDate: source.releaseDate ?? source.metadata?.release_date?.slice(0, 10) ?? null,
    categories,
    nodes,
    get: (fullId) => index.get(fullId),
    replacement: (fullId) => replacements.get(fullId),
  };
}

/** The VRT release bundled with this package. */
export const vrt: Taxonomy = createTaxonomy(VRT_DATA, { deprecated: VRT_DEPRECATED });

/** The nodes from the category down to `node`. */
export function pathOf(node: VrtNode | null): VrtNode[] {
  const path: VrtNode[] = [];
  for (let n = node; n; n = n.parent) path.unshift(n);
  return path;
}
