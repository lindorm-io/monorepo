import { isArray, isString } from "@lindorm/is";
import { FILTERED } from "@lindorm/utils";

/**
 * Redacts a `cookie` request header: every cookie NAME is kept, every VALUE is filtered.
 *
 * Pylon cannot know which cookie carries a session credential — any of them might — so all
 * values go. The names are what you need to see which cookies the client actually sent.
 */
export const redactCookieHeader = (value: unknown): string => {
  if (!isString(value) || !value) return FILTERED;

  return value
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const index = pair.indexOf("=");
      return index < 0 ? FILTERED : `${pair.slice(0, index)}=${FILTERED}`;
    })
    .join("; ");
};

/**
 * Redacts one `set-cookie` response header: the cookie NAME and its attributes
 * (`Path`, `HttpOnly`, `Max-Age`, …) are kept, the VALUE is filtered. The attributes carry
 * no credential and are exactly what you debug a cookie against.
 */
const redactSetCookie = (value: unknown): string => {
  if (!isString(value) || !value) return FILTERED;

  const [pair, ...attributes] = value.split(";");
  const index = pair.indexOf("=");

  if (index < 0) return FILTERED;

  return [`${pair.slice(0, index)}=${FILTERED}`, ...attributes].join(";");
};

/**
 * Redacts the `set-cookie` response header, which node models as an array of cookies but
 * which may also arrive as a single string.
 */
export const redactSetCookieHeader = (value: unknown): string | Array<string> =>
  isArray(value) ? value.map(redactSetCookie) : redactSetCookie(value);
