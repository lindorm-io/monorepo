import { type ReadableTime, ms } from "@lindorm/date";
import { resolve } from "path";
import { buildStaticCacheControl } from "../../internal/utils/static/build-static-cache-control.js";
import {
  type ResolvedStaticOptions,
  serveStaticFile,
} from "../../internal/utils/static/serve-static-file.js";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../types/index.js";

export type UseStaticOptions = {
  root: string;
  maxAge?: ReadableTime | number;
  immutable?: boolean;
  visibility?: "public" | "private";
  precompressed?: boolean;
  directoryListing?: boolean;
};

export const useStatic = <C extends PylonHttpContext = PylonHttpContext>(
  options: UseStaticOptions,
): PylonHttpMiddleware<C> => {
  const maxAgeMs =
    options.maxAge == null
      ? 0
      : typeof options.maxAge === "number"
        ? options.maxAge
        : ms(options.maxAge);

  const resolved: ResolvedStaticOptions = {
    root: resolve(process.cwd(), options.root),
    cacheControl: buildStaticCacheControl({
      visibility: options.visibility ?? "public",
      maxAge: Math.floor(maxAgeMs / 1000),
      immutable: options.immutable ?? false,
    }),
    precompressed: options.precompressed ?? false,
    directoryListing: options.directoryListing ?? false,
  };

  return async function useStaticMiddleware(ctx, _next) {
    await serveStaticFile(ctx, resolved);
  };
};
