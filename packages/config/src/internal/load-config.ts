import { changeKeys } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import c from "config";

/**
 * Loads the merged YAML/JSON config tree from the `config/` directory
 * via `node-config`. Keys are normalised to camelCase so YAML authors
 * can write `snake_case` and have it match the schema's camelCase keys.
 *
 * Environment-variable overrides do NOT happen here — they're applied
 * by `buildEnvOverrides`, which walks the Zod schema directly so env
 * vars work even for keys that have no YAML scaffold.
 */
export const loadConfig = (): Dict => {
  const config = c.util.toObject() as Dict;
  return changeKeys(config, "camel");
};
