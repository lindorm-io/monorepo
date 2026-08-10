/**
 * The operator vocabulary of the condition language, in ONE place.
 *
 * This is the artifact every implementation derives from: `@lindorm/match`
 * dispatches on it, and `@lindorm/proteus` compiles an exhaustive `switch` over
 * it so a missing branch is a BUILD failure rather than a clause that silently
 * matches every row. A hand-maintained second copy is what let `$and` / `$or`
 * fall through the SQL compiler unhandled.
 *
 * Named access (`ConditionOperatorKey.Eq`) is not the point — a condition is
 * written with the literal (`{ age: { $gte: 18 } }`). The object form exists so
 * that each operator's CONTRACT is stated next to the key every implementation
 * shares, rather than in a document that drifts.
 *
 * ## What every docblock states
 *
 * - what the operator means;
 * - what happens when the ROW VALUE is null or absent;
 * - what happens when the OPERAND is null;
 * - whether comparison is deep or by identity;
 * - the payload shape the operator requires.
 *
 * ## Rules that hold for every operator
 *
 * - **Shape is validated.** PRESENCE decides that an operator applies; a payload
 *   of the wrong shape THROWS. There is no truthiness test and no silently
 *   dropped clause.
 * - **`undefined` is stripped before dispatch.** It means "not specified", so
 *   `{ age: { $gte: undefined } }` places no constraint and can never trip a
 *   payload check. `null` is a real value and is never a synonym for it.
 * - **Equality is `isEqual`, everywhere.** Dates by instant, Buffers by content,
 *   objects by structure. No operator compares by reference.
 * - **An operator object is a CONJUNCTION.** Every key present must hold,
 *   including a logical operator sitting among condition operators —
 *   `{ $not: { $lt: 15 }, $lt: 25 }` means both.
 *
 * The names are `*Key` because `ConditionOperator<T>` is already the exported
 * TYPE of an operator PAYLOAD object; these are the keys of that object.
 */
export const ConditionOperatorKey = {
  /**
   * `$exists` — the column is NOT NULL. Not key presence: a relational column
   * always exists, so "is it null" is the only reading every driver can
   * implement.
   *
   * - **row null/absent:** `$exists: true` does not match, `$exists: false` does.
   * - **operand null:** not a boolean, so it throws.
   * - **comparison:** none.
   * - **payload:** a `boolean`. Anything else throws.
   */
  Exists: "$exists",

  /**
   * `$eq` — deep equality, the language's single definition of equal.
   *
   * - **row null/absent:** a null row value matches `$eq: null`; an ABSENT key
   *   does not, because `undefined` and `null` are different things here.
   * - **operand null:** legitimate and respected — this is how you ask for null.
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** any value of the field's type, or `null`. Not shape-checked.
   */
  Eq: "$eq",

  /**
   * `$neq` — the negation of `$eq`, and deep in the same way.
   *
   * - **row null/absent:** matches everything except an operand that equals the
   *   row value, so a null row value matches `$neq: <non-null>`.
   * - **operand null:** legitimate — "is not null".
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** any value of the field's type, or `null`. Not shape-checked.
   */
  Neq: "$neq",

  /**
   * `$gt` — the row value sorts strictly after the operand.
   *
   * - **row null/absent:** DOES NOT MATCH. No throw — one nullable row must not
   *   fail the whole query, and this is what every database does.
   * - **operand null:** THROWS. `null` is not orderable, so it is a malformed
   *   payload rather than a filter.
   * - **comparison:** three-way ordering over `number | Date | bigint | string`;
   *   numbers and bigints inter-compare, nothing else crosses kinds. Strings use
   *   PLAIN JS ordering — no database collation is reproduced, which is a
   *   documented cross-driver divergence. An unorderable row value (boolean,
   *   Buffer, plain object, `NaN`, Invalid Date) throws.
   * - **payload:** one orderable value.
   */
  Gt: "$gt",

  /** `$gte` — as {@link ConditionOperatorKey.Gt}, but sorts after OR equal. */
  Gte: "$gte",

  /** `$lt` — as {@link ConditionOperatorKey.Gt}, but sorts strictly before. */
  Lt: "$lt",

  /** `$lte` — as {@link ConditionOperatorKey.Gt}, but sorts before OR equal. */
  Lte: "$lte",

  /**
   * `$between` — the row value sorts within `[low, high]`, INCLUSIVE at both
   * ends.
   *
   * - **row null/absent:** DOES NOT MATCH, no throw.
   * - **operand null:** THROWS — either bound being null makes the pair
   *   unorderable. Both bounds are checked BEFORE the row value is consulted, so
   *   a malformed payload fails the query rather than only the rows that happen
   *   to reach the second comparison.
   * - **comparison:** the same ordering as {@link ConditionOperatorKey.Gt}.
   * - **payload:** a two-element tuple of orderable values. Anything else throws.
   */
  Between: "$between",

  /**
   * `$like` — SQL `LIKE`: `%` is any run, `_` is any single character,
   * everything else is literal, and the pattern is anchored because `LIKE`
   * matches the WHOLE value.
   *
   * - **row null/absent:** DOES NOT MATCH (a non-string row value never does).
   * - **operand null:** not a string, so it throws.
   * - **comparison:** case-SENSITIVE pattern match.
   * - **payload:** a `string`. Anything else throws.
   */
  Like: "$like",

  /**
   * `$ilike` — {@link ConditionOperatorKey.Like}, case-INSENSITIVE.
   *
   * Case folding is JS's Unicode-aware `i` flag; mysql and sqlite fold by
   * collation-bound `LOWER()`, so non-ASCII results are a documented
   * cross-driver divergence.
   *
   * - **row null/absent:** DOES NOT MATCH.
   * - **operand null:** not a string, so it throws.
   * - **payload:** a `string`. Anything else throws.
   */
  Ilike: "$ilike",

  /**
   * `$regex` — the row value matches the pattern.
   *
   * The engines cannot be made uniform (postgres is POSIX ARE, mysql is ICU,
   * sqlite has none and raises). The GUARANTEE is that anchors, character
   * classes, quantifiers, alternation and the `i` flag behave identically
   * wherever `$regex` is supported; anything beyond that is the engine's own
   * grammar.
   *
   * - **row null/absent:** DOES NOT MATCH (a non-string row value never does).
   * - **operand null:** not a `RegExp`, so it throws.
   * - **comparison:** pattern match, unanchored unless the pattern anchors.
   * - **payload:** a `RegExp`. A STRING throws — the language declares a
   *   `RegExp`, so a string is malformed.
   */
  Regex: "$regex",

  /**
   * `$similar` — PostgreSQL `pg_trgm` trigram similarity.
   *
   * It compiles to a driver-specific query and has NO in-memory equivalent, so
   * evaluating it here ALWAYS THROWS, for every row value and every operand —
   * mirroring the non-Postgres dialects, rather than silently never matching.
   *
   * - **payload:** a `string`, or `{ value, threshold }`, on the drivers that
   *   support it.
   */
  Similar: "$similar",

  /**
   * `$in` — the row value is one of the listed values.
   *
   * - **row null/absent:** matches only when the list contains `null`; an absent
   *   key matches nothing, since `undefined` is not `null`.
   * - **operand null:** `null` is a legitimate LIST MEMBER; a null in place of
   *   the list itself throws.
   * - **comparison:** DEEP (`isEqual`), the same equality `$eq` uses — not
   *   `Array.includes`, which compared Dates and Buffers by identity so
   *   `{ createdAt: { $in: [sameInstant] } }` matched nothing.
   * - **payload:** an array. Anything else throws. `$in: []` is well-formed and
   *   matches NOTHING.
   *
   * A row value that is itself an ARRAY matches when any of its elements is in
   * the list.
   */
  In: "$in",

  /**
   * `$nin` — the negation of {@link ConditionOperatorKey.In}.
   *
   * - **row null/absent:** MATCHES, unless the list contains `null`.
   * - **operand null:** as `$in`.
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** an array. Anything else throws.
   *
   * ⚠ `$nin: []` is well-formed and constrains NOTHING — every row matches.
   * That is correct, and it is why a compiled condition must distinguish "no
   * clause to emit" from "no restriction": on a destructive operation the second
   * one is a table wipe.
   */
  Nin: "$nin",

  /**
   * `$all` — the row's ARRAY contains every listed element.
   *
   * - **row null/absent:** DOES NOT MATCH (nor does any non-array row value).
   * - **operand null:** `null` is a legitimate list member; a null list throws.
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** an array. Anything else throws. `$all: []` matches every
   *   array-valued row and no other.
   */
  All: "$all",

  /**
   * `$overlap` — the row's ARRAY shares at least one element with the list.
   *
   * - **row null/absent:** DOES NOT MATCH (nor does any non-array row value).
   * - **operand null:** `null` is a legitimate list member; a null list throws.
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** an array. Anything else throws. `$overlap: []` matches
   *   nothing.
   */
  Overlap: "$overlap",

  /**
   * `$contained` — every element of the row's ARRAY appears in the list.
   *
   * - **row null/absent:** DOES NOT MATCH (nor does any non-array row value).
   * - **operand null:** `null` is a legitimate list member; a null list throws.
   * - **comparison:** DEEP (`isEqual`).
   * - **payload:** an array. Anything else throws. `$contained: []` matches only
   *   an EMPTY array.
   */
  Contained: "$contained",

  /**
   * `$length` — the row value's length equals the operand: array length, string
   * length, or object KEY COUNT, whichever the value is.
   *
   * - **row null/absent:** DOES NOT MATCH, no throw.
   * - **operand null:** not a number, so it throws.
   * - **comparison:** numeric equality on the count.
   * - **payload:** a `number`. Anything else throws. A row value that is none of
   *   array / string / object throws as unsupported.
   */
  Length: "$length",

  /**
   * `$has` — PLAIN JSON containment, the same thing every SQL dialect emits
   * (`@>` / `JSON_CONTAINS`).
   *
   * - an ARRAY operand needs every element contained by the row value;
   * - a scalar or object operand against an ARRAY row value is contained when
   *   ANY element contains it, so `{ tags: { $has: "a" } }` works on an array
   *   column;
   * - an OBJECT operand against an object row value is a PARTIAL match — every
   *   key of the operand present, its value contained in turn;
   * - anything else compares with `isEqual`.
   *
   * NESTED OPERATORS ARE NOT PART OF IT. `{ $has: { city: { $like: "L%" } } }`
   * searches for a literal `$like` key — an oracle a driver cannot implement is
   * not an oracle. That capability belongs to a dotted path, which does not
   * exist yet.
   *
   * - **row null/absent:** DOES NOT MATCH, unless the operand is itself `null`.
   * - **operand null:** legitimate — it degrades to an equality check.
   * - **comparison:** DEEP (`isEqual` at the leaves).
   * - **payload:** a partial of the field's shape, or one element of it when the
   *   field is an array. Not shape-checked.
   */
  Has: "$has",

  /**
   * `$mod` — `value % divisor === remainder`.
   *
   * - **row null/absent:** DOES NOT MATCH, no throw. A non-number row value
   *   throws as unsupported.
   * - **operand null:** not a number pair, so it throws.
   * - **comparison:** numeric equality on the remainder.
   * - **payload:** a two-element tuple `[divisor, remainder]`, both numbers.
   *   Anything else throws, as does a divisor of `0`.
   */
  Mod: "$mod",
} as const;

export type ConditionOperatorKey =
  (typeof ConditionOperatorKey)[keyof typeof ConditionOperatorKey];

/**
 * The operators that COMBINE conditions rather than constrain one value. They
 * are valid at the root of a condition and inside a field's operator object,
 * and they resolve the same way at both depths.
 *
 * At field level they are AND-ed with their siblings like any other key — a
 * logical operator among condition operators does not take over the object.
 */
export const LogicalOperatorKey = {
  /**
   * `$and` — every member must hold.
   *
   * - **row null/absent:** whatever the members say.
   * - **operand null:** not an array, so it throws.
   * - **comparison:** none of its own.
   * - **payload:** a NON-EMPTY array of conditions. `$and: []` THROWS: `[]` is
   *   not an identity element here, because omitting the key (or passing
   *   `undefined`) already spells "no constraint" and spells it the same way
   *   under either operator, where `[]` would mean "everything" under `$and` and
   *   "nothing" under `$or`.
   */
  And: "$and",

  /**
   * `$or` — at least one member must hold.
   *
   * - **payload:** a NON-EMPTY array of conditions. `$or: []` THROWS, for the
   *   reason given on {@link LogicalOperatorKey.And}.
   */
  Or: "$or",

  /**
   * `$not` — the member must NOT hold. Two-valued: a row the inner condition
   * does not match is a row this one does, including a row whose column is null.
   * SQL's three-valued `NOT (…)` is NOT this, which is why the drivers compile
   * it as `(…) IS NOT TRUE`.
   *
   * - **row null/absent:** matches unless the inner condition matched.
   * - **operand null:** not an object, so it throws.
   * - **payload:** an OBJECT — a condition or an operator bag. A primitive
   *   throws; the undeclared `$not: <primitive>` shorthand it removes compared
   *   by REFERENCE, so a Date, Buffer or array payload was always "not equal"
   *   and the condition constrained nothing at all.
   */
  Not: "$not",
} as const;

export type LogicalOperatorKey =
  (typeof LogicalOperatorKey)[keyof typeof LogicalOperatorKey];

const conditionOperatorKeys: ReadonlyArray<string> = Object.values(ConditionOperatorKey);

const logicalOperatorKeys: ReadonlyArray<string> = Object.values(LogicalOperatorKey);

export const isConditionOperatorKey = (key: string): key is ConditionOperatorKey =>
  conditionOperatorKeys.includes(key);

export const isLogicalOperatorKey = (key: string): key is LogicalOperatorKey =>
  logicalOperatorKeys.includes(key);
