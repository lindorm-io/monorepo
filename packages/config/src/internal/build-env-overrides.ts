import { changeCase } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import { z } from "zod";
import type { ProcessEnv } from "../types/index.js";
import { walkSchemaLeaves } from "./walk-schema.js";

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
 * legitimate value, not "unset"). Values are parsed via `safelyParse`
 * so JSON arrays / objects survive transit, while plain strings stay
 * strings — the schema's `coerceAll` handles primitive coercion.
 */
export const buildEnvOverrides = (schema: z.ZodType, processEnv: ProcessEnv): Dict => {
  const result: Dict = {};

  for (const { path } of walkSchemaLeaves(schema)) {
    if (path.length === 0) continue;

    const envName = buildEnvName(path);
    const raw = processEnv[envName];
    if (raw === undefined) continue;

    setPathValue(result, path, safelyParse(raw));
  }

  return result;
};
