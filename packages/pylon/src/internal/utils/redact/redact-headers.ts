import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { redactCookieHeader, redactSetCookieHeader } from "./redact-cookie-header.js";
import { redactAuthorization } from "./redact-authorization.js";

/**
 * Builds a redacted shallow copy of a header map for logging. The live header object is
 * never mutated.
 *
 * Pylon redacts only the headers pylon itself deals with:
 *
 * - `authorization` — scheme kept, credential redacted per scheme.
 * - `dpop` — the proof JWT: its claims (`htu` / `htm` / `jti` / `iat`) are the debugging
 *   value, the signature is what makes it replayable, so the signature is dropped.
 * - `cookie` / `set-cookie` — names kept, values filtered.
 *
 * Every other header is passed through untouched. Request and response BODIES are the
 * application's business, not pylon's, and are not touched here.
 */
export const redactHeaders = (headers: unknown): Dict => {
  if (!isObject(headers)) return {};

  const redacted: Dict = {};

  for (const [key, value] of Object.entries(headers)) {
    switch (key.toLowerCase()) {
      case "authorization":
        redacted[key] = redactAuthorization(value);
        break;

      case "dpop":
        redacted[key] = sanitiseToken(value);
        break;

      case "cookie":
        redacted[key] = redactCookieHeader(value);
        break;

      case "set-cookie":
        redacted[key] = redactSetCookieHeader(value);
        break;

      default:
        redacted[key] = value;
    }
  }

  return redacted;
};
