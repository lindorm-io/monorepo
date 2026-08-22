import type { TokenContent } from "../../types/index.js";
import type { TokenWire } from "../wire/token-wire.js";
import { detectTokenFormat } from "./detect-token-format.js";

/** A token recognised as an encrypting outer's plaintext, ready to be sealed. */
export type NestedTokenContent = {
  /** The token in the form THIS wire seals — a compact string, or COSE bytes. */
  content: TokenContent;
  /** What the outer must declare its plaintext to be. */
  cty: string;
};

/**
 * Is this plaintext a TOKEN, and if so what does the outer declare it to be?
 *
 * ⚠ The ONE resolution behind both entry points that seal a token: the
 * sign-then-encrypt composition (`encrypt-outer.ts`) and `aegis.encrypt` handed
 * an already-minted token. Without it the bare call infers `text/plain` from the
 * string and emits a nested token carrying no declaration, which a foreign reader
 * has nothing else to go on. RFC 7519 §5.2.
 *
 * Two things have to line up, and the wire owns both:
 *
 * - the CTY, per the format of the token being sealed ({@link TokenWire.nestedTokenCty}) —
 *   `JWT` for a nested JWT, `application/jose` for a bare JOSE object,
 *   `application/cwt` for a CWT;
 * - the CONTENT FORM ({@link TokenWire.decodeToken}) — a compact JOSE token is
 *   already its own string, a COSE token is the BYTES its base64url spells. The
 *   two must agree: a COSE token declared `application/cwt` but sealed as the
 *   base64url TEXT reconstructs to the utf-8 bytes of that text, and the read
 *   side then base64urls those bytes again and finds no token.
 *
 * `undefined` means "not a nested token this wire declares" — either not a token
 * at all, or a format this wire has no registered media type for. The caller
 * seals the value as it stands and the kit's codec states what it is.
 */
export const nestedTokenContent = (
  wire: TokenWire,
  token: string,
): NestedTokenContent | undefined => {
  const format = detectTokenFormat(token);

  if (format === undefined) return undefined;

  const cty = wire.nestedTokenCty[format];

  if (cty === undefined) return undefined;

  return { content: wire.decodeToken(token), cty };
};
