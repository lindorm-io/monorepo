import dotenvx from "@dotenvx/dotenvx";
import { z } from "zod";
import {
  buildEnvOverrides,
  coerceAll,
  deepOverride,
  loadConfig,
  loadNodeConfig,
  loadNpmInfo,
} from "../internal/index.js";
import type { NpmInformation } from "../types/index.js";

export type ConfigurationOptions = {
  /**
   * A file path or `file://` URL (typically `import.meta.url` at the
   * call site) used to locate the package.json that owns this call.
   * The nearest `package.json` walking upward from its directory feeds
   * `config.npm.package.{name, version}`.
   *
   * Without it, `npm.package` falls back to `npm_package_*` env vars
   * (set by `npm run ...`) and then to empty strings — which means
   * bare `node dist/index.js` invocations (Docker CMD, systemd units,
   * process managers) lose package identity silently. Pass
   * `{ scope: import.meta.url }` to make identity resolution
   * deterministic regardless of how the process was launched.
   */
  scope?: string;
};

/**
 * Builds, validates, and types the runtime configuration for a service.
 *
 * Sources, in priority order (later wins):
 *   1. YAML/JSON files under `config/` (loaded via `node-config`)
 *   2. The `NODE_CONFIG` env var (a JSON blob, if set)
 *   3. Environment variables, looked up per schema leaf as
 *      `SEGMENT__SEGMENT__LEAF` (CONSTANT_CASE per segment, joined by
 *      `__`). e.g. `database.maxRetries` ↔ `DATABASE__MAX_RETRIES`.
 *
 * Env binding is **schema-driven**: every leaf in the Zod schema is
 * checked for an env var, regardless of whether the YAML scaffolds it.
 * This means a service can run with no YAML at all so long as the env
 * supplies every required key.
 *
 * Coercion is applied via `coerceAll` so env-supplied strings are
 * parsed into numbers/booleans/dates/etc. according to the schema.
 */
export const configuration = <T extends Record<string, z.ZodType>>(
  schema: T,
  options: ConfigurationOptions = {},
): NpmInformation & z.infer<z.ZodObject<T>> => {
  dotenvx.config({
    path: process.env.NODE_ENV ? [`.env.${process.env.NODE_ENV}`, ".env"] : ".env",
    quiet: true,
  });

  const wrapped = z.object(schema);

  const yaml = loadConfig();
  const node = loadNodeConfig(process.env);
  const env = buildEnvOverrides(wrapped, process.env);

  const merged = deepOverride(yaml, node, env);

  const parsed = coerceAll(wrapped).parse(merged);

  const npm = {
    npm: {
      package: loadNpmInfo(options.scope),
    },
  };

  return deepOverride(parsed as any, npm as any) as any;
};
