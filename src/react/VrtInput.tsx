import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { evaluate, pathName } from '../core/evaluate';
import { formatIssue, formatPriority } from '../core/messages';
import type { VrtMessages, VrtMessagesInput } from '../core/messages';
import { MAX_QUERY_LENGTH, search } from '../core/search';
import { vrt } from '../core/taxonomy';
import type { Level, NodePriority, SearchMatch, Taxonomy, VrtNode, VrtResult } from '../core/types';
import { useVrtMessages } from './messages';
import { useVrt } from './useVrt';

export interface VrtInputProps {
  /** Dotted VRT ID (controlled), such as `cross_site_scripting_xss.stored.self`. */
  value?: string;
  /** Initial VRT ID (uncontrolled). */
  defaultValue?: string;
  /** Called on every change with the new ID and its evaluation. Clearing passes `''`. */
  onChange?: (value: string, result: VrtResult) => void;
  /** `menu` (default): one button that opens a filterable, hierarchical menu. `dropdowns`: three dropdowns. */
  mode?: 'menu' | 'dropdowns';
  /** Default: the bundled VRT. Create a custom one once with `createTaxonomy`, outside render. */
  taxonomy?: Taxonomy;
  /** Accept a category or subcategory that has more specific entries. Default: false. */
  allowPartial?: boolean;
  /** Show the VRT priority of the chosen entry, and of each entry in the menu. Default: false. */
  showPriority?: boolean;
  /** Longest accepted value. Default: 256. */
  maxLength?: number;
  /** Texts in another language, such as `nl`, or a partial catalog. */
  messages?: VrtMessages | VrtMessagesInput;
  readOnly?: boolean;
  disabled?: boolean;
  /** Visible label. Default: "Vulnerability type". */
  label?: string;
  /** Text of the menu button when nothing is chosen. */
  placeholder?: string;
  /** Adds a hidden form field with this name. It holds the normalized ID, or `''` when the value isn't valid. */
  name?: string;
  /** ID of the menu button, or of the category dropdown. */
  id?: string;
  className?: string;
}

/** A VRT picker: a hierarchical menu with a filter, or three linked dropdowns. */
export function VrtInput(props: VrtInputProps) {
  const {
    value,
    defaultValue = '',
    onChange,
    mode = 'menu',
    taxonomy = vrt,
    allowPartial = false,
    showPriority = false,
    maxLength,
    messages: override,
    readOnly = false,
    disabled = false,
    label,
    placeholder,
    name,
    id,
    className,
  } = props;
  const messages = useVrtMessages(override);
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const result = useVrt(current, { taxonomy, allowPartial, maxLength });

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onChange?.(next, evaluate(next, { taxonomy, allowPartial, maxLength }));
    },
    [controlled, onChange, taxonomy, allowPartial, maxLength],
  );

  const base = useId();
  const ids = { label: `${base}-label`, issues: `${base}-issues`, control: id ?? `${base}-control` };
  const shared: PickerProps = {
    result,
    taxonomy,
    allowPartial,
    showPriority,
    messages,
    onSelect: commit,
    readOnly,
    disabled,
    ids,
    label: label ?? messages.ui.label,
    placeholder: placeholder ?? messages.ui.placeholder,
  };

  return (
    <div className={['vrt', className].filter(Boolean).join(' ')} lang={messages.locale} data-mode={mode}>
      {mode === 'dropdowns' ? <VrtDropdowns {...shared} /> : <VrtMenu {...shared} />}
      <IssueList
        id={ids.issues}
        result={result}
        taxonomy={taxonomy}
        messages={messages}
        onUse={readOnly || disabled ? undefined : commit}
      />
      {name !== undefined && <input type="hidden" name={name} value={result.normalized ?? ''} />}
    </div>
  );
}

/** Props shared by the menu and the dropdowns. Exported for custom layouts. */
export interface PickerProps {
  result: VrtResult;
  taxonomy: Taxonomy;
  allowPartial: boolean;
  showPriority: boolean;
  messages: VrtMessages;
  onSelect: (value: string) => void;
  readOnly: boolean;
  disabled: boolean;
  /** `label`: the label element; `issues`: the element that describes problems; `control`: the main control. */
  ids: { label: string; issues: string; control: string };
  label: string;
  placeholder: string;
}

/** True when the result has a problem the user must fix, as opposed to a choice still to make. */
function hasProblem(result: VrtResult): boolean {
  return result.issues.some((i) => i.severity === 'error' && i.code !== 'INCOMPLETE');
}

// ---------------------------------------------------------------------------
// Priority badge

export function PriorityBadge({ priority, messages }: { priority: NodePriority; messages: VrtMessages }) {
  if (priority === null) return null;
  return (
    <span className="vrt-priority" data-priority={priority}>
      {formatPriority(priority, messages)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Issues

function IssueList({
  id,
  result,
  taxonomy,
  messages,
  onUse,
}: {
  id: string;
  result: VrtResult;
  taxonomy: Taxonomy;
  messages: VrtMessages;
  onUse?: (value: string) => void;
}) {
  return (
    <div id={id} className="vrt-issues" aria-live="polite">
      {result.issues.map((issue, i) => {
        const text = formatIssue(issue, messages);
        if (issue.code === 'INCOMPLETE') {
          return (
            <p key={i} className="vrt-hint">
              {text}
            </p>
          );
        }
        const replacement = issue.code === 'DEPRECATED' ? (issue.params.replacement as string | null) : null;
        const target = replacement ? taxonomy.get(replacement) : undefined;
        return (
          <p key={i} className={`vrt-issue vrt-${issue.severity}`}>
            <span className="vrt-sr">
              {issue.severity === 'error' ? messages.ui.error : messages.ui.warning}:{' '}
            </span>
            {text}
            {target && onUse && (
              <>
                {' '}
                <button type="button" className="vrt-link" onClick={() => onUse(target.fullId)}>
                  {messages.ui.useReplacement(pathName(target, messages.ui.pathSeparator))}
                </button>
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdowns

/** Three linked native dropdowns: category, subcategory, and variant. */
export function VrtDropdowns(props: PickerProps) {
  const { result, taxonomy, allowPartial, showPriority, messages, onSelect, readOnly, disabled, ids, label } = props;
  const path = result.path;
  const invalid = hasProblem(result);
  const levels: Level[] = [1, 2, 3];

  return (
    <fieldset className="vrt-dropdowns" aria-describedby={ids.issues}>
      <legend id={ids.label} className="vrt-label">
        {label}
      </legend>
      <div className="vrt-dropdown-row">
        {levels.map((level) => {
          const parent = level === 1 ? null : path[level - 2];
          const chosen = path[level - 1];
          const options = level === 1 ? taxonomy.categories : (parent?.children ?? []);
          const selectId = level === 1 ? ids.control : `${ids.control}-${level}`;
          let empty: string;
          let off = disabled || readOnly;
          if (level === 1) empty = messages.ui.choose[1];
          else if (!parent) {
            empty = messages.ui.choose[level];
            off = true;
          } else if (!options.length) {
            empty = messages.ui.notApplicable;
            off = true;
          } else empty = parent.selectable || allowPartial ? messages.ui.noSpecific[level as 2 | 3] : messages.ui.choose[level];
          return (
            <label key={level} className="vrt-field" htmlFor={selectId}>
              <span className="vrt-field-label">{messages.levels[level]}</span>
              <select
                id={selectId}
                className="vrt-select"
                value={chosen?.id ?? ''}
                disabled={off}
                aria-invalid={invalid && level === 1 ? true : undefined}
                onChange={(e) => {
                  const picked = e.target.value;
                  const prefix = parent ? parent.fullId : '';
                  onSelect(picked ? (prefix ? `${prefix}.${picked}` : picked) : prefix);
                }}
              >
                <option value="">{empty}</option>
                {options.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {showPriority && result.valid && result.priority !== null && (
        <p className="vrt-priority-row">
          {messages.priority.label}: <PriorityBadge priority={result.priority} messages={messages} />
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Menu

interface ColumnOption {
  key: string;
  node: VrtNode;
  /** The "No specific …" option, which chooses the parent itself. */
  self: boolean;
  hasChildren: boolean;
}

function columnOptions(parent: VrtNode | null, taxonomy: Taxonomy, allowPartial: boolean): ColumnOption[] {
  const nodes = parent ? parent.children : taxonomy.categories;
  const options = nodes.map((node) => ({ key: node.fullId, node, self: false, hasChildren: node.children.length > 0 }));
  if (parent && (parent.selectable || allowPartial)) {
    options.unshift({ key: `${parent.fullId}#self`, node: parent, self: true, hasChildren: false });
  }
  return options;
}

function Highlight({ text, ranges }: { text: string; ranges: Array<{ start: number; end: number }> }) {
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start > at) out.push(text.slice(at, r.start));
    out.push(<mark key={i}>{text.slice(r.start, r.end)}</mark>);
    at = r.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

const optionId = (base: string, col: number, index: number) => `${base}-c${col}-${index}`;
const resultId = (base: string, index: number) => `${base}-r${index}`;
const isPrintable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/** A button that opens a menu with a filter field and one column per level. */
export function VrtMenu(props: PickerProps) {
  const { result, taxonomy, allowPartial, showPriority, messages, onSelect, readOnly, disabled, ids, label, placeholder } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string[]>(['', '', '']);
  const [activeResult, setActiveResult] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const filter = useRef<HTMLInputElement>(null);
  const columnRefs = useRef<Array<HTMLUListElement | null>>([]);
  const base = useId();
  const popoverId = `${base}-menu`;
  const valueId = `${base}-value`;
  const resultsId = `${base}-results`;
  const inert = readOnly || disabled;

  // Columns: categories, then the children of the active option in each column.
  const columns = useMemo(() => {
    const cols: ColumnOption[][] = [columnOptions(null, taxonomy, allowPartial)];
    for (let c = 0; c < 2; c++) {
      const opt = cols[c].find((o) => o.key === active[c]);
      if (!opt || opt.self || !opt.hasChildren) break;
      cols.push(columnOptions(opt.node, taxonomy, allowPartial));
    }
    return cols;
  }, [taxonomy, allowPartial, active]);

  const matches: SearchMatch[] = useMemo(
    () => (query.trim() ? search(query, { taxonomy, allowPartial, limit: 100 }) : []),
    [query, taxonomy, allowPartial],
  );
  const searching = query.trim() !== '';

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) trigger.current?.focus();
  }, []);

  const openMenu = () => {
    if (inert) return;
    const keys = ['', '', ''];
    result.path.forEach((n, i) => (keys[i] = n.fullId));
    const last = result.path.at(-1);
    if (result.node && last && last.children.length && result.path.length < 3) keys[result.path.length] = `${last.fullId}#self`;
    setActive(keys);
    setQuery('');
    setOpen(true);
  };

  const choose = (node: VrtNode) => {
    onSelect(node.fullId);
    close(true);
  };

  useEffect(() => {
    if (open) filter.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveResult(0);
  }, [query]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // Keep the active options in view.
  useEffect(() => {
    if (!open) return;
    const els = searching
      ? [document.getElementById(resultId(base, activeResult))]
      : columns.map((col, c) => {
          const i = col.findIndex((o) => o.key === active[c]);
          return i < 0 ? null : document.getElementById(optionId(base, c, i));
        });
    for (const el of els) el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, searching, activeResult, active, columns, base]);

  const setColumnActive = (col: number, key: string) => {
    setActive((prev) => prev.map((k, i) => (i === col ? key : i > col ? '' : k)));
  };

  const activate = (col: number, opt: ColumnOption, viaKeyboard: boolean) => {
    if (opt.hasChildren) {
      setActive((prev) => {
        const next = prev.map((k, i) => (i === col ? opt.key : i > col ? '' : k));
        if (viaKeyboard) next[col + 1] = columnOptions(opt.node, taxonomy, allowPartial)[0]?.key ?? '';
        return next;
      });
      if (viaKeyboard) requestAnimationFrame(() => columnRefs.current[col + 1]?.focus());
      else columnRefs.current[col]?.focus();
    } else choose(opt.node);
  };

  const onColumnKey = (col: number, e: KeyboardEvent<HTMLUListElement>) => {
    const options = columns[col];
    const index = options.findIndex((o) => o.key === active[col]);
    const move = (i: number) => {
      e.preventDefault();
      const opt = options[Math.max(0, Math.min(options.length - 1, i))];
      if (opt) setColumnActive(col, opt.key);
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(index + 1);
      case 'ArrowUp':
        if (index <= 0 && col === 0) {
          e.preventDefault();
          filter.current?.focus();
          return;
        }
        return move(index - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(options.length - 1);
      case 'ArrowRight': {
        e.preventDefault();
        const opt = options[index];
        if (opt?.hasChildren) activate(col, opt, true);
        return;
      }
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) columnRefs.current[col - 1]?.focus();
        return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const opt = options[index];
        if (opt) activate(col, opt, true);
        return;
      }
      case 'Escape':
        e.preventDefault();
        return close(true);
      default:
        if (isPrintable(e)) {
          e.preventDefault();
          setQuery((q) => (q + e.key).slice(0, MAX_QUERY_LENGTH));
          filter.current?.focus();
        }
    }
  };

  const onFilterKey = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (searching) setActiveResult((i) => Math.min(matches.length - 1, i + 1));
        else {
          if (!active[0]) setColumnActive(0, columns[0][0]?.key ?? '');
          columnRefs.current[0]?.focus();
        }
        return;
      case 'ArrowUp':
        if (searching) {
          e.preventDefault();
          setActiveResult((i) => Math.max(0, i - 1));
        }
        return;
      case 'Home':
      case 'End':
        // Leave Home and End to the text field.
        return;
      case 'Enter':
        if (searching && matches[activeResult]) {
          e.preventDefault();
          choose(matches[activeResult].node);
        }
        return;
      case 'Escape':
        e.preventDefault();
        if (query) setQuery('');
        else close(true);
    }
  };

  const onBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && root.current && !root.current.contains(next)) close(false);
  };

  const node = result.node ?? (result.issues.some((i) => i.code === 'INCOMPLETE') ? result.path.at(-1) : undefined);
  const display = node ? pathName(node, messages.ui.pathSeparator) : '';
  const invalid = hasProblem(result);

  return (
    <div className="vrt-menu" ref={root} onBlur={onBlur}>
      <label id={ids.label} className="vrt-label" htmlFor={ids.control}>
        {label}
      </label>
      <div className="vrt-trigger-row">
        <button
          ref={trigger}
          id={ids.control}
          type="button"
          className="vrt-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-labelledby={`${ids.label} ${valueId}`}
          aria-describedby={ids.issues}
          aria-invalid={invalid || undefined}
          aria-disabled={readOnly || undefined}
          disabled={disabled}
          data-readonly={readOnly || undefined}
          onClick={() => (open ? close(false) : openMenu())}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault();
              openMenu();
            }
          }}
        >
          <span id={valueId} className={display ? 'vrt-value' : 'vrt-value vrt-placeholder'}>
            {display || placeholder}
          </span>
          {showPriority && result.valid && <PriorityBadge priority={result.priority} messages={messages} />}
          <span className="vrt-caret" aria-hidden="true" />
        </button>
        {!inert && result.input !== '' && (
          <button type="button" className="vrt-clear" onClick={() => onSelect('')}>
            {messages.ui.clear}
          </button>
        )}
      </div>

      {open && (
        <div id={popoverId} className="vrt-popover" role="dialog" aria-labelledby={ids.label}>
          <input
            ref={filter}
            type="text"
            className="vrt-filter"
            role="combobox"
            aria-label={messages.ui.filter}
            aria-expanded={searching && matches.length > 0}
            aria-controls={searching && matches.length ? resultsId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={searching && matches.length ? resultId(base, activeResult) : undefined}
            placeholder={messages.ui.filterPlaceholder}
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFilterKey}
          />

          {searching ? (
            matches.length ? (
              <ul id={resultsId} className="vrt-results" role="listbox" aria-label={messages.ui.filter}>
                {matches.map((m, i) => {
                  const path: VrtNode[] = [];
                  for (let n: VrtNode | null = m.node; n; n = n.parent) path.unshift(n);
                  return (
                    <li
                      key={m.node.fullId}
                      id={resultId(base, i)}
                      role="option"
                      aria-selected={m.node === result.node}
                      data-active={i === activeResult || undefined}
                      className="vrt-option vrt-result"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(m.node)}
                    >
                      <span className="vrt-result-path">
                        {path.map((n, l) => (
                          <span key={n.fullId} className={l === path.length - 1 ? 'vrt-leaf' : 'vrt-ancestor'}>
                            {l > 0 && <span className="vrt-sep">{messages.ui.pathSeparator}</span>}
                            <Highlight text={n.name} ranges={m.ranges.filter((r) => r.level === n.level)} />
                          </span>
                        ))}
                      </span>
                      {showPriority && <PriorityBadge priority={m.node.priority} messages={messages} />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="vrt-empty">{messages.ui.noResults}</p>
            )
          ) : (
            <div className="vrt-columns">
              {columns.map((options, col) => {
                const index = options.findIndex((o) => o.key === active[col]);
                return (
                  <ul
                    key={col}
                    ref={(el) => {
                      columnRefs.current[col] = el;
                    }}
                    className="vrt-column"
                    role="listbox"
                    tabIndex={0}
                    aria-label={messages.levels[(col + 1) as Level]}
                    aria-activedescendant={index >= 0 ? optionId(base, col, index) : undefined}
                    onKeyDown={(e) => onColumnKey(col, e)}
                    onFocus={() => {
                      // Give a column focused by Tab an active option. Reads the latest state,
                      // because a click sets the active option in the same event.
                      const first = options[0]?.key;
                      if (first) setActive((prev) => (prev[col] ? prev : prev.map((k, i) => (i === col ? first : k))));
                    }}
                  >
                    {options.map((opt, i) => {
                      const selected = opt.node === result.node && (opt.self || !opt.hasChildren);
                      const inPath = !opt.self && result.path.includes(opt.node);
                      return (
                        <li
                          key={opt.key}
                          id={optionId(base, col, i)}
                          role="option"
                          aria-selected={selected}
                          data-active={i === index || undefined}
                          data-path={inPath || undefined}
                          data-self={opt.self || undefined}
                          className="vrt-option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => activate(col, opt, false)}
                        >
                          <span className="vrt-option-name">
                            {opt.self ? messages.ui.noSpecific[(col + 1) as 2 | 3] : opt.node.name}
                          </span>
                          {showPriority && (opt.self || !opt.hasChildren) && (
                            <PriorityBadge priority={opt.node.priority} messages={messages} />
                          )}
                          {opt.hasChildren && (
                            <>
                              <span className="vrt-sr">{messages.ui.childCount(opt.node.children.length)}</span>
                              <span className="vrt-chevron" aria-hidden="true" />
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                );
              })}
            </div>
          )}

          <div className="vrt-sr" role="status">
            {searching ? (matches.length ? messages.ui.results(matches.length) : messages.ui.noResults) : ''}
          </div>
          {taxonomy.version && <p className="vrt-footer">{messages.ui.taxonomyVersion(taxonomy.version)}</p>}
        </div>
      )}
    </div>
  );
}
