/**
 * What compiling a condition produces. THREE states, because two of them used
 * to share the empty string and the difference between them is a table wipe:
 *
 * - `always-true` — the condition places NO RESTRICTION. `{ tag: { $nin: [] } }`
 *   is this: well-formed, correctly typed, and satisfied by every row.
 * - `always-false` — the condition can never hold. `{ tag: { $in: [] } }` is
 *   this.
 * - `clause` — SQL that restricts the result set.
 *
 * `compilePredicate` used to return `""` for BOTH "no restriction" and "nothing
 * to emit", and every call site read it as *skip*. So `$nin: []` compiled away
 * to a `DELETE` with no `WHERE` at all while `$in: []` correctly compiled to
 * `FALSE`. Naming the third state is what lets a destructive operation refuse an
 * `always-true` while `find` still accepts it.
 */
export type CompiledCondition =
  | { kind: "clause"; sql: string }
  | { kind: "always-true" }
  | { kind: "always-false" };

export const ALWAYS_TRUE: CompiledCondition = { kind: "always-true" };

export const ALWAYS_FALSE: CompiledCondition = { kind: "always-false" };

export const compiledClause = (sql: string): CompiledCondition => ({
  kind: "clause",
  sql,
});

/**
 * Conjunction. The algebra lives HERE rather than at each call site: an
 * `always-true` member drops out, one `always-false` member collapses the whole
 * conjunction, and an empty conjunction constrains nothing.
 *
 * A single surviving clause is returned unwrapped — every clause a dialect emits
 * is already self-contained (the two that hold a top-level `OR` parenthesise
 * themselves), so the parentheses would only be noise.
 */
export const conjoin = (conditions: Array<CompiledCondition>): CompiledCondition => {
  const clauses: Array<string> = [];

  for (const condition of conditions) {
    if (condition.kind === "always-false") return ALWAYS_FALSE;
    if (condition.kind === "always-true") continue;
    clauses.push(condition.sql);
  }

  if (clauses.length === 0) return ALWAYS_TRUE;
  if (clauses.length === 1) return compiledClause(clauses[0]);

  return compiledClause(`(${clauses.join(" AND ")})`);
};

/** Disjunction — the mirror of {@link conjoin}. */
export const disjoin = (conditions: Array<CompiledCondition>): CompiledCondition => {
  const clauses: Array<string> = [];

  for (const condition of conditions) {
    if (condition.kind === "always-true") return ALWAYS_TRUE;
    if (condition.kind === "always-false") continue;
    clauses.push(condition.sql);
  }

  if (clauses.length === 0) return ALWAYS_FALSE;
  if (clauses.length === 1) return compiledClause(clauses[0]);

  return compiledClause(`(${clauses.join(" OR ")})`);
};

/**
 * Negation, which flips the two constant states rather than needing a `"FALSE"`
 * literal special-cased at each `$not`.
 *
 * A clause negates to `(…) IS NOT TRUE`, NOT to SQL's `NOT (…)`: the criteria
 * language is the matcher's, whose negation is two-valued. For a NULL column
 * `NOT (col = 'x')` is UNKNOWN and drops the row, while the matcher keeps it.
 */
export const negate = (condition: CompiledCondition): CompiledCondition => {
  switch (condition.kind) {
    case "always-true":
      return ALWAYS_FALSE;

    case "always-false":
      return ALWAYS_TRUE;

    case "clause":
      return compiledClause(`(${condition.sql}) IS NOT TRUE`);

    default: {
      const exhaustive: never = condition;
      throw new Error(`Unknown compiled condition [ ${JSON.stringify(exhaustive)} ]`);
    }
  }
};

/**
 * Render a compiled condition as a SQL fragment.
 *
 * `""` now means ONE thing — no restriction — so a call site testing the string
 * for emptiness is correct rather than accidentally correct. `always-false`
 * renders as the literal `FALSE`, which every dialect accepts in a boolean
 * position.
 */
export const renderCondition = (condition: CompiledCondition): string => {
  switch (condition.kind) {
    case "always-true":
      return "";

    case "always-false":
      return "FALSE";

    case "clause":
      return condition.sql;

    default: {
      const exhaustive: never = condition;
      throw new Error(`Unknown compiled condition [ ${JSON.stringify(exhaustive)} ]`);
    }
  }
};
