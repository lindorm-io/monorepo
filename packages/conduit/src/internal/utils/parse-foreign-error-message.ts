import { isObjectLike, isString } from "@lindorm/is";

const usable = (value: unknown): value is string =>
  isString(value) && value.trim().length > 0;

/**
 * The message a NON-pylon upstream gave us, or `null` when it gave us none.
 *
 * Reads the shapes that actually occur: a nested envelope, a flat `message`, the OAuth2
 * `error_description` (RFC 6749 §5.2), the `detail` of an `application/problem+json` body
 * (RFC 9457), the OAuth2 `{ error: "invalid_grant" }` form, and a plain `text/plain` body.
 *
 * The problem+json `type` is NOT read across: it is a URI, typically `https://…`, and an
 * error type must be a URN. A foreign error is typed from its status instead.
 */
export const parseForeignErrorMessage = (body: any): string | null => {
  if (usable(body)) return body;
  if (!isObjectLike(body)) return null;

  const candidates = [
    isObjectLike(body.error) ? body.error.message : undefined,
    body.message,
    body.error_description,
    body.detail,
    body.error,
  ];

  return candidates.find(usable) ?? null;
};
