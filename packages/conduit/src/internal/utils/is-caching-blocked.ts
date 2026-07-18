/**
 * Whether a response `Cache-Control` value forbids caching the response itself.
 *
 * Only a BARE `no-store` or `no-cache` directive blocks. A field-scoped
 * `no-cache="set-cookie"` (RFC 7234 §5.2.2.2, argument form) marks only the
 * NAMED header(s) as uncacheable — the response body IS still cacheable — so it
 * must NOT block. The old `value.includes("no-cache")` treated the argument form
 * as a blanket no-cache and dropped every such response from the cache.
 *
 * Directives are comma-separated (RFC 7234 §5.2); an argument form always
 * carries an `=`, so an exact token match after trim/lower-case distinguishes the
 * bare directive from the field-scoped one — and never false-matches a quoted
 * field-list value that happens to contain a comma.
 */
export const isCachingBlocked = (cacheControl: string): boolean =>
  cacheControl
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .some((directive) => directive === "no-store" || directive === "no-cache");
