import { B64 } from "@lindorm/b64";
import { isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { FILTERED, sanitiseToken } from "@lindorm/utils";

/**
 * Redaction for the headers conduit itself writes or receives.
 *
 * Conduit's own auth middleware puts credentials into request headers
 * (`Authorization: Bearer|Basic|DPoP …`, `DPoP: <proof>`) and servers put session
 * material into `set-cookie` — all of which the request/response loggers would otherwise
 * write verbatim. What survives redaction is what makes a log useful without making it
 * dangerous: the auth *scheme*, the basic-auth *username*, the cookie *names*, and a
 * token's header + payload (never its signature — see `sanitiseToken`).
 *
 * Header names are matched case-insensitively: conduit writes `Authorization` / `DPoP`
 * capitalised, while inbound node headers arrive lower-cased.
 */

const redactBasicCredential = (credential: string): string => {
  try {
    const decoded = B64.decode(credential, "base64");
    const index = decoded.indexOf(":");

    // Not a `user:pass` pair — no structure to keep, so drop it whole.
    if (index < 0) return FILTERED;

    return `${decoded.slice(0, index)}:${FILTERED}`;
  } catch {
    return FILTERED;
  }
};

const redactAuthorization = (value: unknown): string => {
  if (!isString(value)) return FILTERED;

  const index = value.indexOf(" ");

  if (index < 0) return FILTERED;

  const scheme = value.slice(0, index);
  const credential = value.slice(index + 1);

  switch (scheme.toLowerCase()) {
    case "bearer":
    case "dpop":
      return `${scheme} ${sanitiseToken(credential)}`;

    case "basic":
      return `${scheme} ${redactBasicCredential(credential)}`;

    // Fail closed: an unknown scheme carries an unknown credential format.
    default:
      return FILTERED;
  }
};

const redactCookiePair = (pair: string): string => {
  const index = pair.indexOf("=");

  if (index < 0) return FILTERED;

  return `${pair.slice(0, index)}=${FILTERED}`;
};

const redactCookie = (value: unknown): string => {
  if (!isString(value)) return FILTERED;

  return value.split(";").map(redactCookiePair).join(";");
};

const redactSetCookie = (value: unknown): string | Array<string> => {
  if (isArray(value)) return value.map((entry) => redactSetCookie(entry) as string);
  if (!isString(value)) return FILTERED;

  // Only the first segment is the `name=value` pair; the rest are attributes
  // (Path / HttpOnly / Expires / …) which are useful and carry nothing secret.
  const [pair, ...attributes] = value.split(";");

  return [redactCookiePair(pair), ...attributes].join(";");
};

export const redactHeaderValue = (name: string, value: unknown): unknown => {
  switch (name.trim().toLowerCase()) {
    case "authorization":
      return redactAuthorization(value);

    case "dpop":
      return sanitiseToken(value);

    case "cookie":
      return redactCookie(value);

    case "set-cookie":
      return redactSetCookie(value);

    default:
      return value;
  }
};

/**
 * Builds a redacted shallow copy — the live headers object is never mutated.
 */
export const redactHeaders = <T extends Dict<any>>(
  headers: T | undefined,
): T | undefined => {
  if (!headers) return undefined;

  const result: Dict<any> = {};

  for (const [key, value] of Object.entries(headers)) {
    result[key] = redactHeaderValue(key, value);
  }

  return result as T;
};

/**
 * Redacts a raw `\r\n`-delimited header block (node's `ClientRequest.header`), which is a
 * verbatim dump of every request header — `Authorization` included.
 */
export const redactRawHeaders = (raw: unknown): unknown => {
  if (!isString(raw)) return raw;

  return raw
    .split("\r\n")
    .map((line) => {
      const index = line.indexOf(":");

      // The request line (`GET /path HTTP/1.1`) and the trailing blank line.
      if (index < 0) return line;

      const name = line.slice(0, index);
      const value = line.slice(index + 1).trim();
      const redacted = redactHeaderValue(name, value);

      return redacted === value ? line : `${name}: ${String(redacted)}`;
    })
    .join("\r\n");
};
