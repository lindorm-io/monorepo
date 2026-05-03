import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";

/**
 * Layered config merge with **replacement** semantics, suitable for
 * stacking sources by priority (later wins).
 *
 * Differs from `@lindorm/utils` `merge` in one critical respect:
 * arrays here are treated as opaque values that fully replace any
 * earlier value rather than being concatenated. That's what you want
 * for config — if `process.env.HOSTS='["a"]'` overrides a YAML
 * `hosts: ["x", "y"]`, the result must be `["a"]`, not `["x", "y", "a"]`.
 *
 * Plain objects merge recursively. Anything else (arrays, primitives,
 * null) replaces wholesale.
 */
export const deepOverride = (...sources: Array<Dict | undefined>): Dict => {
  const result: Dict = {};

  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;

      if (isObject(value) && isObject(result[key])) {
        result[key] = deepOverride(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};
