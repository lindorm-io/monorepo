import dotenvx from "@dotenvx/dotenvx";
import { merge } from "@lindorm/utils";
import { z } from "zod";
import type { NpmInformation } from "../types/index.js";
import { coerceAll, loadConfig, loadNodeConfig, loadNpmInfo } from "../internal/index.js";

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

export const configuration = <T extends Record<string, z.ZodType>>(
  schema: T,
  options: ConfigurationOptions = {},
): NpmInformation & z.infer<z.ZodObject<T>> => {
  dotenvx.config({
    path: process.env.NODE_ENV ? [`.env.${process.env.NODE_ENV}`, ".env"] : ".env",
    quiet: true,
  });

  const config = loadConfig(process.env);
  const node = loadNodeConfig(process.env);
  const merged = merge(config, node);

  const zod = coerceAll(z.object(schema));
  const parsed = zod.parse(merged);

  const npm = {
    npm: {
      package: loadNpmInfo(options.scope),
    },
  };

  return merge(parsed as any, npm as any);
};
