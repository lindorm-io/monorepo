import type {
  ConduitCacheKey,
  ConduitResponse,
  IConduitCacheDriver,
} from "@lindorm/conduit";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cacheId } from "./canonical.js";

type Options = {
  /** Root directory for the browsable request/response capture tree. */
  dir: string;
};

type Captured = {
  fetchedAt: string;
  expiresAt: string | null;
  request: ConduitCacheKey;
  response: ConduitResponse;
};

// Lay the capture out as dir/<host>/<slug>/<hash>.json so the tree is
// human-browsable while the hash keeps distinct query/body variants apart.
const fileFor = (dir: string, key: ConduitCacheKey): string => {
  let host = "unknown-host";
  let path = key.url;

  try {
    const parsed = new URL(key.url);
    host = parsed.host;
    path = parsed.pathname;
  } catch {
    /* non-absolute url: fall back to the raw string */
  }

  const slug = path.replace(/^\/+|\/+$/g, "").replaceAll("/", "-") || "root";

  return join(dir, host, slug, `${cacheId(key)}.json`);
};

/**
 * Node-only conduit cache driver backed by a browsable on-disk capture tree.
 * Each entry stores the originating request alongside the response, so the
 * directory doubles as an inspectable record of what was fetched. Expiry is
 * enforced on read against a stored `expiresAt`.
 */
export const createFileCacheDriver = (options: Options): IConduitCacheDriver => {
  const { dir } = options;

  return {
    async get(key) {
      const file = fileFor(dir, key);

      const captured = await readFile(file, "utf8")
        .then((raw) => JSON.parse(raw) as Captured)
        .catch(() => null);

      if (!captured) return null;

      if (captured.expiresAt && Date.now() >= Date.parse(captured.expiresAt)) {
        return null;
      }

      return {
        response: captured.response,
        storedAt: Date.parse(captured.fetchedAt),
      };
    },

    async set(key, response, ttl) {
      const file = fileFor(dir, key);
      const now = Date.now();

      const captured: Captured = {
        fetchedAt: new Date(now).toISOString(),
        expiresAt: ttl !== undefined ? new Date(now + ttl).toISOString() : null,
        request: key,
        response,
      };

      await mkdir(dirname(file), { recursive: true });

      // Write to a unique temp file then rename — rename is atomic on POSIX, so
      // a crash or a concurrent writer can never leave a half-written
      // (unparseable) capture at the final path.
      const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
      await writeFile(tmp, `${JSON.stringify(captured, null, 2)}\n`, "utf8");
      await rename(tmp, file);
    },
  };
};
