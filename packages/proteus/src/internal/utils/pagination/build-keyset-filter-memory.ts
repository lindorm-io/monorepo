import type { KeysetOrderEntry } from "./build-keyset-order.js";

/**
 * Create an in-memory predicate function implementing keyset (seek) pagination
 * using boolean expansion.
 *
 * For ordered columns (a ASC, b DESC) seeking AFTER cursor values (c, d):
 *   row => (row.a > c) || (row.a === c && row.b < d)
 *
 * This is used by the Memory driver because Predicated.match does not support
 * $gt/$lt on string types (only number and Date). The in-memory filter handles
 * all comparable types: string, number, Date, boolean.
 *
 * @param entries   Keyset order entries (column + direction)
 * @param values    Cursor values aligned with entries
 * @param backward  If true, flip comparison operators (for last/before)
 * @returns A filter function that returns true for rows past the cursor boundary
 */
export const buildKeysetFilterMemory = (
  entries: Array<KeysetOrderEntry>,
  values: Array<unknown>,
  backward: boolean,
): ((row: Record<string, unknown>) => boolean) => {
  if (entries.length === 0) return () => true;

  return (row: Record<string, unknown>): boolean => {
    for (let depth = 0; depth < entries.length; depth++) {
      // Check equality prefix: columns 0..depth-1
      let prefixMatch = true;
      for (let i = 0; i < depth; i++) {
        if (!isEqual(row[entries[i].column], values[i])) {
          prefixMatch = false;
          break;
        }
      }
      if (!prefixMatch) continue;

      // Strict inequality at position `depth`
      const entry = entries[depth];
      const rowVal = row[entry.column];
      const cursorVal = values[depth];

      if (passesComparison(rowVal, cursorVal, entry.direction, backward)) {
        return true;
      }
    }

    return false;
  };
};

/**
 * Compare two values with null-safe semantics matching PostgreSQL sort order:
 * - NULLs sort LAST for ASC, FIRST for DESC (PostgreSQL default)
 */
const passesComparison = (
  rowVal: unknown,
  cursorVal: unknown,
  direction: "ASC" | "DESC",
  backward: boolean,
): boolean => {
  if (rowVal == null && cursorVal == null) return false;

  if (rowVal == null) {
    // ASC NULLS LAST: null is "after" everything → forward(>): true, backward(<): false
    // DESC NULLS FIRST: null is "before" everything → forward(<): false, backward(>): true
    return direction === "ASC" ? !backward : backward;
  }

  if (cursorVal == null) {
    return direction === "ASC" ? backward : !backward;
  }

  const cmp = compareValues(rowVal, cursorVal);
  if (cmp === 0) return false;

  // ASC forward: want > (cmp > 0), ASC backward: want < (cmp < 0)
  // DESC forward: want < (cmp < 0), DESC backward: want > (cmp > 0)
  if (direction === "ASC") {
    return backward ? cmp < 0 : cmp > 0;
  }
  return backward ? cmp > 0 : cmp < 0;
};

const isEqual = (a: unknown, b: unknown): boolean => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date) return a.getTime() === new Date(b as string | number).getTime();
  if (b instanceof Date) return new Date(a as string | number).getTime() === b.getTime();

  return a === b;
};

/**
 * Compare two non-null values. Returns negative, zero, or positive.
 * Handles Date, number, string, and boolean comparisons.
 */
const compareValues = (a: unknown, b: unknown): number => {
  // Date comparison (including ISO string on either side)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a instanceof Date) return a.getTime() - new Date(b as string | number).getTime();
  if (b instanceof Date) return new Date(a as string | number).getTime() - b.getTime();

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;

  // Fallback: coerce to string
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};
