import { ServerError } from "@lindorm/errors";
import { createReadStream, type Stats } from "fs";
import { stat } from "fs/promises";
import { extname } from "path";
import type { PylonHttpContext } from "../../../types/index.js";
import { buildStaticEtag } from "./build-static-etag.js";
import { listStaticDirectory } from "./list-static-directory.js";
import { parseRangeHeader } from "./parse-range-header.js";
import { resolveStaticPath } from "./resolve-static-path.js";
import { selectStaticVariant, type StaticEncoding } from "./select-static-variant.js";
import { staticNotFound } from "./static-not-found.js";

export type ResolvedStaticOptions = {
  root: string;
  cacheControl: string;
  precompressed: boolean;
  directoryListing: boolean;
};

const statFile = async (path: string): Promise<Stats | null> => {
  try {
    return await stat(path);
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return null;
    }
    throw new ServerError("Unable to stat static file", {
      code: "static_file_stat_failed",
      title: "Static File Stat Failed",
      details: "The requested static file could not be read from disk.",
      type: "urn:lindorm:pylon:error:static_file_stat_failed",
      error,
      debug: { path },
    });
  }
};

// If-Range only applies when a Range is present. Our ETags are weak, so an
// entity-tag If-Range can never match (RFC 9110 demands strong comparison) —
// ignore the Range and serve full. A date-form If-Range honours the Range only
// when it exactly equals our Last-Modified value.
const shouldHonorRange = (ifRange: string, lastModified: string): boolean => {
  if (ifRange.startsWith("W/") || ifRange.startsWith('"')) return false;
  return ifRange === lastModified;
};

const serveDirectory = async (
  ctx: PylonHttpContext,
  directory: string,
): Promise<void> => {
  // A listing must never be cached, even on an immutable mount.
  ctx.set("Cache-Control", "no-store");
  ctx.status = 200;

  if (ctx.method === "HEAD") return;

  ctx.body = await listStaticDirectory(directory);
};

const serveFile = async (
  ctx: PylonHttpContext,
  originalPath: string,
  originalStats: Stats,
  options: ResolvedStaticOptions,
): Promise<void> => {
  const variant = await selectStaticVariant(ctx, originalPath, options.precompressed);

  let servedPath = originalPath;
  let servedStats = originalStats;
  let encoding: StaticEncoding | null = variant.encoding;

  if (variant.encoding && variant.path !== originalPath) {
    const variantStats = await statFile(variant.path);
    if (variantStats) {
      servedPath = variant.path;
      servedStats = variantStats;
    } else {
      encoding = null;
    }
  }

  const lastModified = servedStats.mtime.toUTCString();

  // Content-Type is always the original extension, never the sibling's.
  ctx.type = extname(originalPath);
  ctx.set("Cache-Control", options.cacheControl);
  ctx.set("ETag", buildStaticEtag(servedStats.size, servedStats.mtimeMs, encoding));
  ctx.set("Last-Modified", lastModified);
  ctx.set("Accept-Ranges", "bytes");

  // Shared-cache correctness: signal negotiation whenever the mount can vary,
  // even on identity responses.
  if (options.precompressed) {
    ctx.set("Vary", "Accept-Encoding");
  }
  if (encoding) {
    ctx.set("Content-Encoding", encoding);
  }

  // koa defaults ctx.status to 404 during middleware, and its `fresh` getter
  // only evaluates validators for a 2xx/304 status — set 200 first so the
  // conditional check actually runs.
  ctx.status = 200;

  if (ctx.fresh) {
    ctx.status = 304;
    return;
  }

  const rangeHeader = ctx.get("Range");
  const ifRange = ctx.get("If-Range");

  const range =
    rangeHeader && (!ifRange || shouldHonorRange(ifRange, lastModified))
      ? parseRangeHeader(rangeHeader, servedStats.size)
      : { type: "ignore" as const };

  if (range.type === "unsatisfiable") {
    ctx.set("Content-Range", `bytes */${servedStats.size}`);

    // HEAD: koa's HEAD branch keeps an explicit Content-Length and sends no
    // body — mirror the GET response (which drops Content-Type via the null
    // body) so the two are byte-for-byte identical in headers.
    if (ctx.method === "HEAD") {
      ctx.remove("Content-Type");
      ctx.set("Content-Length", "0");
      ctx.status = 416;
      return;
    }

    // GET: koa would otherwise write the status message ("Range Not
    // Satisfiable") as the body. Setting body null flips the status to 204 and
    // yields Content-Length: 0, so restore 416 afterwards.
    ctx.body = null;
    ctx.status = 416;
    return;
  }

  const isRange = range.type === "satisfiable";
  const length = isRange ? range.end - range.start + 1 : servedStats.size;

  if (isRange) {
    ctx.status = 206;
    ctx.set("Content-Range", `bytes ${range.start}-${range.end}/${servedStats.size}`);
  } else {
    ctx.status = 200;
  }

  // HEAD: never open a read stream (unconsumed stream = fd leak). Set the length
  // header explicitly — koa's HEAD branch preserves it and sends no body.
  if (ctx.method === "HEAD") {
    ctx.set("Content-Length", String(length));
    return;
  }

  ctx.body = createReadStream(
    servedPath,
    isRange ? { start: range.start, end: range.end } : undefined,
  );
  // koa's body setter strips Content-Length for streams — restore it after.
  ctx.length = length;
};

export const serveStaticFile = async (
  ctx: PylonHttpContext,
  options: ResolvedStaticOptions,
): Promise<void> => {
  const absolutePath = resolveStaticPath(options.root, ctx.params.path);

  const stats = await statFile(absolutePath);
  if (!stats) {
    throw staticNotFound({ path: absolutePath });
  }

  if (stats.isDirectory()) {
    if (!options.directoryListing) {
      // Do not reveal that a directory exists — same miss as everything else.
      throw staticNotFound({ path: absolutePath });
    }
    return serveDirectory(ctx, absolutePath);
  }

  if (!stats.isFile()) {
    throw staticNotFound({ path: absolutePath });
  }

  return serveFile(ctx, absolutePath, stats, options);
};
