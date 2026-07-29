import type { Condition } from "@lindorm/match";
import type { IEntity } from "../../../interfaces/index.js";
import type { KeysetOrderEntry } from "./build-keyset-order.js";

/**
 * Build a Condition implementing keyset (seek) pagination using boolean
 * expansion. Works with both SQL (compile-where) and memory (Matcher.match).
 *
 * For ordered columns (a ASC, b DESC) seeking AFTER cursor values (c, d):
 *   { $or: [
 *     { a: { $gt: c } },
 *     { $and: [{ a: c }, { b: { $lt: d } }] }
 *   ]}
 *
 * For 3 columns (a ASC, b DESC, c ASC) after (x, y, z):
 *   { $or: [
 *     { a: { $gt: x } },
 *     { $and: [{ a: x }, { b: { $lt: y } }] },
 *     { $and: [{ a: x }, { b: y }, { c: { $gt: z } }] }
 *   ]}
 *
 * @param entries   Keyset order entries (column + direction)
 * @param values    Cursor values aligned with entries
 * @param backward  If true, flip comparison operators (for last/before)
 * @returns Condition that filters rows past the cursor boundary
 */
export const buildKeysetPredicate = <E extends IEntity>(
  entries: Array<KeysetOrderEntry>,
  values: Array<unknown>,
  backward: boolean,
): Condition<E> => {
  if (entries.length === 0) return {} as Condition<E>;

  const disjuncts: Array<Condition<E>> = [];

  for (let depth = 0; depth < entries.length; depth++) {
    const conjuncts: Array<Condition<E>> = [];

    // Equality prefix: columns 0..depth-1
    for (let i = 0; i < depth; i++) {
      conjuncts.push({
        [entries[i].column]: values[i],
      } as Condition<E>);
    }

    // Strict inequality at position `depth`
    const entry = entries[depth];
    const op = getComparisonOp(entry.direction, backward);
    conjuncts.push({
      [entry.column]: { [op]: values[depth] },
    } as Condition<E>);

    if (conjuncts.length === 1) {
      disjuncts.push(conjuncts[0]);
    } else {
      disjuncts.push({ $and: conjuncts } as Condition<E>);
    }
  }

  if (disjuncts.length === 1) {
    return disjuncts[0];
  }

  return { $or: disjuncts } as Condition<E>;
};

/**
 * Determine the predicate operator based on sort direction and seek direction.
 *
 * Forward (after cursor):  ASC -> $gt,  DESC -> $lt
 * Backward (before cursor): ASC -> $lt,  DESC -> $gt
 */
const getComparisonOp = (direction: "ASC" | "DESC", backward: boolean): "$gt" | "$lt" => {
  if (direction === "ASC") return backward ? "$lt" : "$gt";
  return backward ? "$gt" : "$lt";
};
