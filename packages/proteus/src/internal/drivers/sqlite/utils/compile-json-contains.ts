import { isArray, isBoolean, isNull, isObject } from "@lindorm/is";
import type { MetaField } from "../../../entity/types/metadata.js";

/**
 * JSON containment for SQLite, which has no containment operator at all — no
 * `@>`, no `JSON_CONTAINS`. It is built out of `json_each` and `json_extract`,
 * and it has to be built RECURSIVELY, because containment is recursive: an array
 * contains an operand when some element contains it, and an object contains an
 * operand when every key is present and its value contains the operand's in
 * turn.
 *
 * What it deliberately does NOT do is evaluate operators. `$has` is PLAIN
 * containment, so `{ payload: { $has: { city: { $like: "L%" } } } }` searches for
 * a literal `"$like"` key — the same thing `@>` and `JSON_CONTAINS` do. An
 * oracle a driver cannot implement is not an oracle.
 *
 * Which containment is meant comes from the DECLARED column type: an `array`
 * column matches against its ELEMENTS, an `object` column against its KEYS.
 */

/**
 * Descending into an OBJECT extends the path instead of nesting `json_extract`,
 * because SQLite's JSON functions RAISE on a non-JSON argument: reaching a
 * string leaf and then parsing it — `json_type('dark', '$."x"')` — is "malformed
 * JSON", where postgres and mysql simply answer false. Asking the whole path of
 * the document in one call returns NULL for a path that is not there, whatever
 * the leaf holds.
 */
const extendPath = (path: string, key: string): string =>
  `${path}."${key.replace(/"/g, '""').replace(/'/g, "''")}"`;

/**
 * A path can be extended, but `json_each` needs a real argument — so wherever a
 * new base expression starts (an array reached through a path, or one array
 * element inside another) the value has to be made safe first. `json_valid`
 * answers without raising; anything that is not JSON becomes an empty list or a
 * JSON null, which contains nothing.
 */
const asJson = (expr: string): string => `iif(json_valid(${expr}), ${expr}, 'null')`;

const asJsonArray = (expr: string): string =>
  `iif(json_type(${asJson(expr)}) = 'array', ${expr}, '[]')`;

/**
 * SQLite has no boolean storage class and `json_extract` yields 1 / 0 for JSON
 * true / false, so a JS boolean has to be bound as the integer it will be
 * compared against — the driver refuses to bind one at all otherwise.
 */
const bindScalar = (params: Array<unknown>, value: unknown): string => {
  params.push(isBoolean(value) ? Number(value) : value);
  return "?";
};

const conjoin = (clauses: Array<string>): string =>
  clauses.length === 1 ? clauses[0] : `(${clauses.join(" AND ")})`;

/**
 * Does the JSON value `expr` denotes contain `operand`?
 *
 * `trusted` says the expression is a declared JSON column, so it needs no
 * validity wrapper. Everything reached below one is untrusted: an array element
 * or an extracted leaf can be a plain scalar.
 *
 * `depth` only names the `json_each` aliases, so a nested containment can refer
 * to the element it is testing without shadowing the one outside it.
 */
const valueContains = (
  expr: string,
  trusted: boolean,
  params: Array<unknown>,
  operand: unknown,
  depth: number,
): string => {
  if (isArray<unknown>(operand)) {
    return arrayContains(expr, trusted, params, operand, depth);
  }
  if (isObject(operand)) {
    return objectContains(trusted ? expr : asJson(expr), "$", params, operand, depth);
  }

  // `json_each.value` and `json_extract` both hand back the UNQUOTED scalar, so
  // a scalar operand compares against the raw bound value — not against
  // `json(?)`, which renders a string as `"a"` and matched nothing at all.
  if (isNull(operand)) return `${expr} IS NULL`;
  return `${expr} = ${bindScalar(params, operand)}`;
};

/** Every listed element must be contained by SOME element of the array. */
const arrayContains = (
  expr: string,
  trusted: boolean,
  params: Array<unknown>,
  operand: Array<unknown>,
  depth: number,
): string => {
  // Every element of an empty list is trivially present — but only in a row that
  // HAS a list.
  if (operand.length === 0) {
    return `json_type(${trusted ? expr : asJson(expr)}) = 'array'`;
  }

  return conjoin(
    operand.map((element) => elementContains(expr, trusted, params, element, depth)),
  );
};

const elementContains = (
  expr: string,
  trusted: boolean,
  params: Array<unknown>,
  operand: unknown,
  depth: number,
): string => {
  const alias = `_e${depth}`;
  const source = trusted ? expr : asJsonArray(expr);
  const inner = valueContains(`${alias}.value`, false, params, operand, depth + 1);
  return `EXISTS (SELECT 1 FROM json_each(${source}) AS ${alias} WHERE ${inner})`;
};

/**
 * Every key of the operand must be PRESENT and its value contained in turn.
 * Presence is asked with `json_type(<base>, <path>)` rather than by extracting —
 * `json_extract` yields SQL NULL both for an absent key and for a JSON null, and
 * those are different answers.
 */
const objectContains = (
  base: string,
  path: string,
  params: Array<unknown>,
  operand: Record<string, unknown>,
  depth: number,
): string => {
  const keys = Object.keys(operand);

  // An empty object is contained by any object.
  if (keys.length === 0) return `json_type(${base}, '${path}') = 'object'`;

  return conjoin(
    keys.map((key) => {
      const childPath = extendPath(path, key);
      const present = `json_type(${base}, '${childPath}') IS NOT NULL`;
      const value = operand[key];

      if (isNull(value)) return `json_type(${base}, '${childPath}') = 'null'`;

      if (isObject(value)) {
        return `(${present} AND ${objectContains(base, childPath, params, value, depth)})`;
      }

      const childExpr = `json_extract(${base}, '${childPath}')`;

      if (isArray<unknown>(value)) {
        return `(${present} AND ${arrayContains(childExpr, false, params, value, depth)})`;
      }

      return `(${present} AND ${childExpr} = ${bindScalar(params, value)})`;
    }),
  );
};

export const compileJsonContains = (
  col: string,
  params: Array<unknown>,
  value: unknown,
  field: MetaField | null,
): string => {
  // An OBJECT column is asked about its keys. An operand that is not an object
  // can never be contained by one — the condition language falls through to
  // equality there, and an object never equals an array or a scalar.
  if (field?.type === "object") {
    if (!isObject(value)) return "0 = 1";
    return objectContains(col, "$", params, value, 0);
  }

  // An ARRAY column is asked about its ELEMENTS, so a non-array operand is a
  // single element to look for — `{ tags: { $has: "a" } }`, and equally the bare
  // `{ tags: ["a"] }`. Comparing it to the column itself would be asking whether
  // the whole array equals "a", which is never true.
  if (isArray<unknown>(value)) return arrayContains(col, true, params, value, 0);
  return elementContains(col, true, params, value, 0);
};
