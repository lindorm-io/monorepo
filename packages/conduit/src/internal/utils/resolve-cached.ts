import type { Dict, Header } from "@lindorm/types";

const getHeader = (headers: Dict<Header>, name: string): string | null => {
  const lower = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return value == null ? null : String(value);
    }
  }

  return null;
};

const isHit = (value: string | null): boolean => value?.toUpperCase() === "HIT";

const includesHit = (value: string | null): boolean =>
  value != null && value.toUpperCase().includes("HIT");

/**
 * Infer whether a response was served from a cache, based on its headers.
 *
 * - `"client"` — conduit's own cache middleware served it (nearest cache; takes
 *   precedence when both markers are present).
 * - `"upstream"` — a cache further out served it: pylon's `useCache`
 *   (`x-pylon-cache`), a CDN/proxy (`x-cache`, `cf-cache-status`,
 *   `x-cache-status`), or a positive RFC 7234 `Age`.
 * - `null` — no cache marker found.
 */
export const resolveCached = (headers: Dict<Header>): "upstream" | "client" | null => {
  if (isHit(getHeader(headers, "x-conduit-cache-middleware"))) {
    return "client";
  }

  if (
    isHit(getHeader(headers, "x-pylon-cache")) ||
    includesHit(getHeader(headers, "x-cache")) ||
    isHit(getHeader(headers, "cf-cache-status")) ||
    includesHit(getHeader(headers, "x-cache-status"))
  ) {
    return "upstream";
  }

  const age = getHeader(headers, "age");

  if (age != null) {
    const parsed = Number(age);

    if (Number.isFinite(parsed) && parsed > 0) return "upstream";
  }

  return null;
};
