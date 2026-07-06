import type { ILogger } from "@lindorm/logger";

// Unconditionally CORS-safelisted request headers (Fetch spec). The browser
// never lists them in a preflight's Access-Control-Request-Headers, so putting
// them in `allowHeaders` has no effect.
const SAFELISTED_REQUEST_HEADERS = ["accept", "accept-language", "content-language"];

/**
 * Canonicalise an array `allowHeaders` list (never called for `"*"`):
 * - strips (with a WARN) every header pylon manages, so the list never carries
 *   a header that has no effect or that pylon injects itself;
 * - auto-injects `content-type` exactly once — it is safelisted ONLY for
 *   form/text bodies, never `application/json`, so JSON APIs always need it and
 *   always forget it;
 * - de-duplicates.
 *
 * `range` is conditionally safelisted but left untouched (neither stripped nor
 * injected). Input is assumed already lower-cased by the caller.
 */
export const normaliseAllowHeaders = (
  headers: Array<string>,
  logger?: ILogger,
): Array<string> => {
  const result: Array<string> = [];
  const seen = new Set<string>();

  for (const header of headers) {
    if (SAFELISTED_REQUEST_HEADERS.includes(header)) {
      logger?.warn(
        `CORS allowHeaders: "${header}" is already CORS-safelisted — listing has no effect; removing.`,
      );
      continue;
    }

    if (header === "content-type") {
      logger?.warn(
        `CORS allowHeaders: "content-type" is auto-injected by pylon — no need to list it; removing (added back below).`,
      );
      continue;
    }

    if (seen.has(header)) continue;

    seen.add(header);
    result.push(header);
  }

  // Inject content-type last, so it lands exactly once regardless of whether the
  // caller listed it.
  result.push("content-type");

  return result;
};
