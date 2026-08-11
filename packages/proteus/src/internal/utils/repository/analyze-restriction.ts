import { isArray, isObject, isUndefined } from "@lindorm/is";
import {
  ConditionOperatorKey,
  LogicalOperatorKey,
  isConditionOperatorKey,
  isLogicalOperatorKey,
} from "@lindorm/match";

/**
 * What a criteria object actually RESTRICTS — the question the destructive
 * guard has to answer, and the one counting criteria keys could not.
 *
 * - `always-true` — every row satisfies it. `{}`, `{ id: undefined }` and
 *   `{ tag: { $nin: [] } }` are all this: well-formed, correctly typed, and
 *   satisfied by every row.
 * - `always-false` — no row can satisfy it. `{ tag: { $in: [] } }` is this.
 * - `restricts` — some rows match and some do not.
 */
export type ConditionRestriction = "always-true" | "always-false" | "restricts";

/**
 * The same three-state algebra {@link CompiledCondition} does over SQL, over the
 * condition instead — one `always-false` member collapses a conjunction, an
 * `always-true` member drops out, and an empty conjunction restricts nothing.
 */
const conjoin = (parts: Array<ConditionRestriction>): ConditionRestriction => {
  if (parts.includes("always-false")) return "always-false";
  if (parts.includes("restricts")) return "restricts";
  return "always-true";
};

/** Disjunction — the mirror of {@link conjoin}. */
const disjoin = (parts: Array<ConditionRestriction>): ConditionRestriction => {
  if (parts.length === 0) return "always-false";
  if (parts.includes("always-true")) return "always-true";
  if (parts.includes("restricts")) return "restricts";
  return "always-false";
};

/** Negation flips the two constant states; a real restriction stays one. */
const negate = (part: ConditionRestriction): ConditionRestriction => {
  switch (part) {
    case "always-true":
      return "always-false";

    case "always-false":
      return "always-true";

    case "restricts":
      return "restricts";

    default: {
      const exhaustive: never = part;
      throw new Error(`Unknown restriction [ ${String(exhaustive)} ]`);
    }
  }
};

/**
 * The keys of an operator bag that were actually SUPPLIED. `undefined` means
 * "not specified", so it is stripped before anything is read off the bag — and a
 * bag whose every value was `undefined` constrains nothing, which is exactly the
 * shape that turned `delete({ name: undefined })` into a full table wipe on the
 * in-memory drivers.
 */
const suppliedEntries = (bag: Record<string, unknown>): Array<[string, unknown]> =>
  Object.entries(bag).filter(([, operand]) => !isUndefined(operand));

/**
 * One operator's contribution. Only the membership pair and the logical
 * operators can be constant — every other operator either restricts or is a
 * malformed payload the driver refuses on its own.
 *
 * The `switch` is exhaustive over the vocabulary `@lindorm/match` owns, so a new
 * operator is a BUILD failure here rather than an operator the guard silently
 * reads as restricting.
 */
const analyzeOperator = (
  key: ConditionOperatorKey | LogicalOperatorKey,
  operand: unknown,
): ConditionRestriction => {
  switch (key) {
    // `$in: []` can never hold, and `$nin: []` — its negation — excludes
    // nothing, so every row satisfies it. That pair is the whole reason this
    // analysis exists: `deleteMany({ tag: { $nin: excluded } })` with an empty
    // exclusion list is well-formed, correctly typed, and deletes the table.
    case ConditionOperatorKey.In:
      return isArray<unknown>(operand) && operand.length === 0
        ? "always-false"
        : "restricts";

    case ConditionOperatorKey.Nin:
      return negate(analyzeOperator(ConditionOperatorKey.In, operand));

    case LogicalOperatorKey.Not:
      return negate(analyzeFieldCondition(operand));

    case LogicalOperatorKey.And:
      return isArray<unknown>(operand)
        ? conjoin(operand.map(analyzeFieldCondition))
        : "restricts";

    case LogicalOperatorKey.Or:
      return isArray<unknown>(operand)
        ? disjoin(operand.map(analyzeFieldCondition))
        : "restricts";

    case ConditionOperatorKey.Eq:
    case ConditionOperatorKey.Neq:
    case ConditionOperatorKey.Gt:
    case ConditionOperatorKey.Gte:
    case ConditionOperatorKey.Lt:
    case ConditionOperatorKey.Lte:
    case ConditionOperatorKey.Between:
    case ConditionOperatorKey.Like:
    case ConditionOperatorKey.Ilike:
    case ConditionOperatorKey.Regex:
    case ConditionOperatorKey.Similar:
    case ConditionOperatorKey.Exists:
    case ConditionOperatorKey.All:
    case ConditionOperatorKey.Overlap:
    case ConditionOperatorKey.Contained:
    case ConditionOperatorKey.Length:
    case ConditionOperatorKey.Has:
    case ConditionOperatorKey.Mod:
      return "restricts";

    default: {
      const exhaustive: never = key;
      throw new Error(`Unknown operator [ ${String(exhaustive)} ]`);
    }
  }
};

/**
 * ONE column's condition value — the unit a field name maps to, and the same
 * unit a member of a field-level `$and` / `$or` / `$not` is. Read the same way
 * at both call sites, so a mixed object resolves identically at every depth.
 */
const analyzeFieldCondition = (value: unknown): ConditionRestriction => {
  if (isUndefined(value)) return "always-true";

  // `isObject` is decided by PROTOTYPE, so a Date, a Buffer and a RegExp are
  // values here rather than operator bags — as are arrays, which are containment.
  if (!isObject<Record<string, unknown>>(value)) return "restricts";

  return conjoin(
    suppliedEntries(value).map(([key, operand]) =>
      isConditionOperatorKey(key) || isLogicalOperatorKey(key)
        ? analyzeOperator(key, operand)
        : // A non-`$` key is a bare nested object — JSON containment, which
          // always restricts. An unknown `$` key is a malformed condition every
          // driver refuses on its own; reading it as restricting leaves that
          // error to the driver rather than shadowing it with this one.
          "restricts",
    ),
  );
};

/**
 * Decide what a criteria object restricts, WITHOUT compiling it.
 *
 * The guard used to count `Object.keys(criteria).length`, which answers a
 * different question: `{ tag: { $nin: [] } }` has one key, passes, and deletes
 * every row. Its own error text said "so the operation does not affect every
 * row", so counting keys was never what it meant to test.
 *
 * Analysing the CONDITION rather than each driver's compiled output is what
 * makes one answer hold for all six drivers. A per-driver post-compile check
 * cannot: "empty WHERE clause" is a SQL-shaped property that mongo has no
 * equivalent of (`$nin: []` compiles to a non-empty filter that is always true),
 * and a compiled clause also carries framework-injected predicates — a
 * soft-delete `deletedAt IS NULL` makes the WHERE non-empty on criteria the
 * CALLER left unrestricted, which is the exact hole the check exists to close.
 */
export const analyzeRestriction = (criteria: unknown): ConditionRestriction => {
  if (!isObject<Record<string, unknown>>(criteria)) return "restricts";

  return conjoin(
    suppliedEntries(criteria).map(([key, value]) => {
      switch (key) {
        // An empty `$and` / `$or` array is an error in the condition language,
        // and each driver raises it. Until it is raised, an empty conjunction
        // restricts nothing — so the guard refuses it either way.
        case LogicalOperatorKey.And:
          return isArray<unknown>(value)
            ? conjoin(value.map(analyzeRestriction))
            : "restricts";

        case LogicalOperatorKey.Or:
          return isArray<unknown>(value)
            ? disjoin(value.map(analyzeRestriction))
            : "restricts";

        case LogicalOperatorKey.Not:
          return negate(analyzeRestriction(value));

        default:
          return analyzeFieldCondition(value);
      }
    }),
  );
};
