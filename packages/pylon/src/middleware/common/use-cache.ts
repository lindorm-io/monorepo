import { type ReadableTime, ms } from "@lindorm/date";
import { ServerError } from "@lindorm/errors";
import type { IProteusSource } from "@lindorm/proteus";
import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import type { CachedResponsePayload } from "../../entities/CachedResponse.js";
import { CACHE_SOURCE } from "../../internal/constants/symbols.js";
import { isHttpContext } from "../../internal/utils/is-context.js";
import { resolveActor } from "../../internal/utils/resolve-actor.js";
import type {
  PylonContext,
  PylonHttpContext,
  PylonMiddleware,
} from "../../types/index.js";

type CacheScope = "private" | "public";

type CacheOptions = {
  vary?: Array<string>;
  skip?: (ctx: PylonContext) => boolean;
  // Per-route override for the identity folded into a `private` key. Defaults to
  // pylon's `resolveActor` (access-token sub → id-token sub → basic-auth user).
  // Called directly (not memoised) so a route may key on a different identity
  // (e.g. tenant) than the request-wide actor.
  actor?: (ctx: PylonContext) => string;
};

type CaptureResult = {
  cacheable: boolean;
  status: number;
  body: unknown;
  etag?: string;
};

// Cap the serialized body that may be stored. Oversized responses are served
// directly but never cached (and a warning is logged).
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

const sha256 = new ShaKit({ algorithm: "SHA256", encoding: "hex" });
const hex = (data: string): string => sha256.hash(data);

const varyValues = (ctx: PylonHttpContext, vary: Array<string>): string =>
  vary.map((header) => `${header.toLowerCase()}=${ctx.get(header) ?? ""}`).join("&");

const buildKey = (
  ctx: PylonHttpContext,
  scope: CacheScope,
  actor: string,
  vary: Array<string>,
): string => {
  const data = ctx.data ?? {};
  const parts = [
    ctx.method,
    ctx.path,
    JSON.stringify(sortKeys(data)),
    scope === "private" ? actor : "",
    varyValues(ctx, vary),
  ];

  return hex(parts.join("\n"));
};

const matchesEtag = (ifNoneMatch: string, etag: string): boolean => {
  if (ifNoneMatch.trim() === "*") return true;

  return ifNoneMatch
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === etag || value === `W/${etag}`);
};

const capture = (ctx: PylonHttpContext): CaptureResult => {
  const status = ctx.status;
  const body = ctx.body;

  if (status < 200 || status > 299) return { cacheable: false, status, body };
  if (body === undefined || body === null || body === "") {
    return { cacheable: false, status, body };
  }
  if (typeof (body as any)?.pipe === "function") {
    return { cacheable: false, status, body };
  }
  if (ctx.response.get("Location")) return { cacheable: false, status, body };

  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return { cacheable: false, status, body };
  }

  if (serialized === undefined) return { cacheable: false, status, body };

  if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
    ctx.logger.warn("Response body exceeds cache size cap; skipping cache", {
      bytes: Buffer.byteLength(serialized),
      cap: MAX_BODY_BYTES,
    });
    return { cacheable: false, status, body };
  }

  return { cacheable: true, status, body, etag: `"${hex(serialized)}"` };
};

export const useCache = (
  ttl: ReadableTime | number,
  scope: CacheScope,
  options: CacheOptions = {},
): PylonMiddleware => {
  const ttlMs = typeof ttl === "number" ? ttl : ms(ttl);
  const ttlSeconds = Math.floor(ttlMs / 1000);
  const cacheControl = `${scope}, max-age=${ttlSeconds}`;
  const vary = options.vary ?? [];

  // In-process single-flight registry. Scoped to this middleware closure (one
  // per Pylon process); NOT distributed — cross-container duplication is
  // acceptable by design.
  const inFlight = new Map<string, Promise<CaptureResult>>();

  return async function cacheMiddleware(ctx, next) {
    if (!isHttpContext(ctx)) {
      await next();
      return;
    }
    if (options.skip?.(ctx)) {
      ctx.set("X-Pylon-Cache", "BYPASS");
      await next();
      return;
    }

    const rawSource = (ctx as any)[CACHE_SOURCE] as IProteusSource | undefined;
    if (!rawSource) {
      throw new ServerError("Response cache is not configured", {
        code: "cache_not_configured",
        type: "urn:lindorm:pylon:error:cache_not_configured",
        title: "Response Cache Not Configured",
        details:
          "Enable the response cache in PylonOptions with cache: { enabled: true } before using useCache",
      });
    }

    // Namespaced diagnostic headers (X-Pylon-Cache*) so they don't collide with
    // CDN/proxy `X-Cache` in the response chain. Standard cache headers
    // (Cache-Control/ETag/Age/Vary) keep their real names.
    const emitHeaders = (
      state: "HIT" | "MISS",
      etag: string | undefined,
      age: number,
    ) => {
      ctx.set("X-Pylon-Cache", state);
      if (etag) ctx.set("ETag", etag);
      ctx.set("Cache-Control", cacheControl);
      ctx.set("Age", String(age));
      if (ctx.state?.app?.environment !== "production") {
        ctx.set("X-Pylon-Cache-Source", rawSource.driverType);
      }
    };

    if (vary.length) ctx.set("Vary", vary.join(", "));

    const reqCacheControl = (ctx.get("Cache-Control") ?? "").toLowerCase();
    const reqPragma = (ctx.get("Pragma") ?? "").toLowerCase();
    const ifNoneMatch = ctx.get("If-None-Match") ?? "";

    const noStore = reqCacheControl.includes("no-store");
    const noCache =
      reqCacheControl.includes("no-cache") ||
      reqCacheControl.includes("max-age=0") ||
      reqPragma.includes("no-cache");

    // no-store: bypass entirely, no read, no write.
    if (noStore) {
      ctx.set("X-Pylon-Cache", "BYPASS");
      await next();
      return;
    }

    // Never cache a private response under a global key: if the scope is
    // private but no actor can be resolved, run the handler uncached.
    let actor = "";
    if (scope === "private") {
      actor = options.actor ? options.actor(ctx) : resolveActor(ctx);
      if (!actor || actor === "unknown") {
        // Private scope with no identity: never cache under a global key (it
        // would leak across users). Fail closed — serve uncached — but warn so a
        // misconfigured `private` route (or missing auth) is visible rather than
        // silently never caching.
        ctx.logger.warn(
          "Response cache: `private` scope with no resolvable actor; skipping cache",
          { method: ctx.method, path: ctx.path },
        );
        ctx.set("X-Pylon-Cache", "DYNAMIC");
        await next();
        return;
      }
    }

    const key = buildKey(ctx, scope, actor, vary);
    // Dynamically import the entity so the static module graph from index.js
    // stays free of @lindorm/proteus (iris/proteus optionality).
    const { CachedResponse } = await import("../../entities/CachedResponse.js");
    const repository = rawSource
      .session({ logger: ctx.logger })
      .repository(CachedResponse);

    // READ (skipped on a no-cache request, which forces a refresh).
    if (!noCache) {
      try {
        const entry = await repository.findOne({ id: key });

        if (entry && (!entry.expiresAt || entry.expiresAt.getTime() > Date.now())) {
          const payload = entry.payload;
          const age = Math.max(0, Math.floor((Date.now() - payload.storedAt) / 1000));

          if (ifNoneMatch && matchesEtag(ifNoneMatch, payload.etag)) {
            ctx.status = 304;
            ctx.body = null;
            emitHeaders("HIT", payload.etag, age);
            return;
          }

          ctx.status = payload.status;
          ctx.body = payload.body;
          emitHeaders("HIT", payload.etag, age);
          return;
        }
      } catch (error: any) {
        // A cache backend outage must never fail a request: degrade to the
        // handler.
        ctx.logger.warn("Response cache read failed; serving handler", { error });
      }
    }

    // MISS — in-process single-flight (stampede protection).
    const pending = inFlight.get(key);
    if (pending) {
      // A rejected originator (handler threw) resolves to null here → the waiter
      // falls back to an independent run below.
      const result = await pending.catch(() => null);

      if (result?.cacheable) {
        ctx.status = result.status;
        ctx.body = result.body;
        emitHeaders("HIT", result.etag, 0);
        return;
      }

      // Non-cacheable (or the originator threw): run independently; nothing stored.
      await next();
      ctx.set("X-Pylon-Cache", "DYNAMIC");
      return;
    }

    const promise = (async () => {
      await next();
      return capture(ctx);
    })();
    inFlight.set(key, promise);

    let result: CaptureResult;
    try {
      result = await promise;
    } finally {
      inFlight.delete(key);
    }

    if (!result.cacheable) {
      // Computed but not eligible to store (3xx / stream / >=400 / oversize).
      ctx.set("X-Pylon-Cache", "DYNAMIC");
      return;
    }

    const now = Date.now();
    const payload: CachedResponsePayload = {
      status: result.status,
      body: result.body,
      etag: result.etag!,
      storedAt: now,
    };

    try {
      await repository.upsert({
        id: key,
        payload,
        expiresAt: new Date(now + ttlMs),
      } as any);
    } catch (error: any) {
      // Storage failure must not fail the request; the handler output is
      // already on ctx.
      ctx.logger.warn("Response cache write failed; serving handler", { error });
    }

    emitHeaders("MISS", result.etag, 0);
  };
};
