import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { FILTERED, sanitiseToken } from "@lindorm/utils";

/**
 * Redaction for the request / response bodies conduit itself deals with.
 *
 * The client-credentials middleware posts `client_secret` to a token endpoint and consumes
 * `access_token` from its response, and both bodies end up in the request / response
 * loggers (and, on failure, in the thrown error's `debug.transport`). Only those keys are
 * touched: this is a **shallow, known-key pass over the top level**, not a deep walk of an
 * arbitrary response body — walking a caller's payload is expensive and none of conduit's
 * business.
 *
 * Keys are matched shape-insensitively (`client_secret` / `clientSecret` / `client-secret`)
 * because bodies pass through conduit's snake/camel case middleware.
 */

// Tokens keep their header + payload (debuggable, unusable). See `sanitiseToken`.
const TOKEN_KEYS = ["accesstoken", "refreshtoken", "idtoken"];

// Secrets have no debuggable structure — they go entirely.
const SECRET_KEYS = ["clientsecret", "password", "secret"];

const SENSITIVE_PATTERN =
  /(client[_-]?secret|password|secret|access[_-]?token|refresh[_-]?token|id[_-]?token)["']?\s*[:=]/i;

const normalise = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const redactObject = (data: Dict): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(data)) {
    const normalised = normalise(key);

    result[key] = TOKEN_KEYS.includes(normalised)
      ? sanitiseToken(value)
      : SECRET_KEYS.includes(normalised)
        ? FILTERED
        : value;
  }

  return result;
};

const redactStringData = (data: string): string => {
  try {
    const parsed = JSON.parse(data);

    if (isObject(parsed)) return JSON.stringify(redactObject(parsed));
  } catch {
    // Not JSON — fall through to the pattern check below.
  }

  // A serialised body we cannot structurally parse, but which names a sensitive key
  // (`client_secret=…`). Nothing to keep safely: fail closed.
  return SENSITIVE_PATTERN.test(data) ? FILTERED : data;
};

export const redactData = (data: unknown): unknown => {
  if (isString(data)) return redactStringData(data);
  if (isObject(data)) return redactObject(data);

  return data;
};
