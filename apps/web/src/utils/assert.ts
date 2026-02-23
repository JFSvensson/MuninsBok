/**
 * Assert a value is non-null/undefined and return it.
 * Use in queryFn/mutationFn where `enabled` guards the call but TypeScript can't prove narrowing.
 */
export function defined<T>(value: T | null | undefined, name = "value"): T {
  if (value == null) {
    throw new Error(`Expected ${name} to be defined`);
  }
  return value;
}
