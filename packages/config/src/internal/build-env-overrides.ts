import { changeCase } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import { z } from "zod";
import type { ProcessEnv } from "../types/index.js";
import { getDef, walkSchemaLeaves } from "./walk-schema.js";

// Leaf types where an env value is a JSON string that must be parsed into a
// structure before Zod can validate it (Zod coercion can't turn "[1,2]" into an
// array). Everything else — string/number/boolean/bigint/date/enum, and unions
// (ambiguous, so kept raw) — stays a raw string and is coerced by `coerceAll`.
const STRUCTURED = new Set(["array", "object", "record", "tuple", "set", "map"]);

const WRAPPERS = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "nonoptional",
]);

const isStructuredLeaf = (schema: z.ZodType): boolean => {
  let def = getDef(schema);
  while (def.type && WRAPPERS.has(def.type)) {
    def = getDef(def.innerType as z.ZodType);
  }
  return def.type ? STRUCTURED.has(def.type) : false;
};

/**
 * Builds the CONSTANT_CASE env-var name for a given schema path.
 *
 * Path segments are joined with `__` (double underscore); each segment
 * is converted from camelCase to CONSTANT_CASE individually. This
 * keeps the segment boundary unambiguous when segments themselves
 * contain word breaks:
 *
 *   `pylon.kek`           → `PYLON__KEK`
 *   `database.maxRetries` → `DATABASE__MAX_RETRIES`
 *   `db.aws.accessKey`    → `DB__AWS__ACCESS_KEY`
 */
const buildEnvName = (path: ReadonlyArray<string>): string =>
  path.map((segment) => changeCase(segment, "constant")).join("__");

const setPathValue = (
  target: Dict,
  path: ReadonlyArray<string>,
  value: unknown,
): void => {
  let cursor: Dict = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = cursor[key];
    if (existing === undefined || existing === null || typeof existing !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Dict;
  }
  cursor[path[path.length - 1]] = value;
};

/**
 * Walks the schema and produces a sparse nested object of env-derived
 * values. Only paths that have a corresponding env var present are
 * filled — anything else is left absent so YAML / schema defaults
 * flow through.
 *
 * Empty-string env values are intentionally preserved (`""` is a
 * legitimate value, not "unset").
 *
 * Coercion is schema-directed: only **structured** leaves (array / record /
 * tuple / …) are JSON-parsed, because Zod cannot turn a `"[1,2]"` string into an
 * array. **Primitive** leaves (string / number / boolean / bigint / date, and
 * ambiguous unions) are kept as raw strings and typed by the schema's
 * `coerceAll` — so a numeric-looking id is not silently JSON-parsed into a lossy
 * float.
 */
export const buildEnvOverrides = (schema: z.ZodType, processEnv: ProcessEnv): Dict => {
  const result: Dict = {};

  for (const { path, schema: leaf } of walkSchemaLeaves(schema)) {
    if (path.length === 0) continue;

    const envName = buildEnvName(path);
    const raw = processEnv[envName];
    if (raw === undefined) continue;

    // Parse JSON only for structured leaves; keep primitives as raw strings so a
    // numeric-looking id (e.g. a 19-digit snowflake) survives instead of being
    // JSON-parsed into a lossy float. `coerceAll` handles primitive typing.
    const value = isStructuredLeaf(leaf) ? safelyParse(raw) : raw;
    setPathValue(result, path, value);
  }

  return result;
};
