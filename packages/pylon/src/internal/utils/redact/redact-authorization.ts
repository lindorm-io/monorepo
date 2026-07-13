import { B64 } from "@lindorm/b64";
import { isString } from "@lindorm/is";
import { FILTERED, sanitiseToken } from "@lindorm/utils";

/**
 * Redacts the credential of a `Basic` authorization header.
 *
 * RFC 7617 allows the password to contain colons, so the split is on the FIRST colon
 * only — the whole remainder is the password and is filtered in full. The username is
 * an identifier, not a secret, so it stays visible.
 *
 * A credential that is not valid base64, or that does not decode to `username:password`, is
 * filtered whole; there is no structure to keep. Redaction runs on the logging path, so it
 * never throws on a malformed header.
 */
const redactBasicCredential = (credential: string): string => {
  let decoded: string;

  try {
    decoded = B64.toString(credential);
  } catch {
    return FILTERED;
  }

  const index = decoded.indexOf(":");

  if (index < 0) return FILTERED;

  return `${decoded.slice(0, index)}:${FILTERED}`;
};

/**
 * Redacts an `authorization` header value for logging.
 *
 * - **Bearer / DPoP** — the credential is a JOSE token: keep `header.payload`, drop the
 *   signature. The claims are the debugging value; the signature is what makes the token
 *   usable.
 * - **Basic** — keep the username, filter the password.
 * - **Anything else** — filtered in full. An unknown scheme has no structure we can safely
 *   cut away, so this fails closed.
 */
export const redactAuthorization = (value: unknown): string => {
  if (!isString(value) || !value) return FILTERED;

  const [scheme, ...rest] = value.split(" ");
  const credential = rest.join(" ");

  if (!scheme || !credential) return FILTERED;

  switch (scheme.toLowerCase()) {
    case "bearer":
    case "dpop":
      return `${scheme} ${sanitiseToken(credential)}`;

    case "basic":
      return `${scheme} ${redactBasicCredential(credential)}`;

    default:
      return FILTERED;
  }
};
