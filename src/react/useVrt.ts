import { useMemo } from 'react';
import { evaluate } from '../core/evaluate';
import type { EvaluateOptions, VrtResult } from '../core/types';

/** `evaluate(value, options)`, memoized on the value and each option. */
export function useVrt(value: string, options: EvaluateOptions = {}): VrtResult {
  const { taxonomy, allowPartial, maxLength } = options;
  return useMemo(() => evaluate(value, { taxonomy, allowPartial, maxLength }), [value, taxonomy, allowPartial, maxLength]);
}
