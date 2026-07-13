import { isString } from "@lindorm/is";

// The redaction literal, shared so every package that redacts speaks the same
// word (it matches the logger's default filter callback).
export const FILTERED = "[Filtered]";

/**
 * Sanitises a token so it can be logged.
 *
 * The JOSE header (`alg` / `kid` / `typ`) and the payload claims are what you need to
 * debug a token; the signature is what makes it *usable*. Dropping the signature makes
 * a logged token unusable while keeping it debuggable.
 *
 * - **JWS / JWT (3 parts)** → `header.payload`, signature dropped.
 * - **JWE (5 parts)** → protected header only; nothing else is readable anyway.
 * - **Anything else** (opaque, malformed, empty, non-string) → `[Filtered]`. There is no
 *   structure to cut away safely, so it is redacted in full.
 */
export const sanitiseToken = (token: unknown): string => {
  if (!isString(token) || !token) return FILTERED;

  const split = token.split(".");

  switch (split.length) {
    case 3:
      return `${split[0]}.${split[1]}`;

    case 5:
      return split[0];

    default:
      return FILTERED;
  }
};
