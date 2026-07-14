import { isNumber, isObjectLike, isString } from "@lindorm/is";

const usable = (value: unknown): value is string | number =>
  (isString(value) && value.length > 0) || isNumber(value);

/**
 * The error code a NON-pylon upstream gave us, or `null` when it gave us none.
 *
 * A foreign server names its errors however it likes, so this reads the shapes that actually
 * occur — a nested envelope (`{ error: { code } }`), a flat `code` / `error_code`, and the
 * OAuth2 form `{ error: "invalid_grant" }` (RFC 6749 §5.2) — and takes the first that carries
 * a usable value. Nothing is invented: a body that names no code yields an error with none.
 *
 * Axios's own `err.code` is deliberately NOT a fallback. For an HTTP response it is a pure
 * function of the status — `ERR_BAD_REQUEST` for every 4xx, `ERR_BAD_RESPONSE` for every 5xx
 * (axios `settle.js`) — so it repeats the status and identifies nothing.
 */
export const parseForeignErrorCode = (body: any): string | number | null => {
  if (!isObjectLike(body)) return null;

  const candidates = [
    isObjectLike(body.error) ? body.error.code : undefined,
    body.code,
    body.error_code,
    body.errorCode,
    body.error,
  ];

  return candidates.find(usable) ?? null;
};
