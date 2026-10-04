import { AegisDomainError } from "../../errors/index.js";
import type { TokenFormat } from "../../types/index.js";
import type { TokenWire } from "../wire/token-wire.js";

/**
 * The caller's own type assertion (`assert.tokenType`) against a verified token's
 * type header — ONE implementation for both wires and for every signed token
 * `aegis.verify` reads, claims-bearing or opaque.
 *
 * ⚠ It compares the whole media type, not the bare prefix the kits take. A type
 * whose short name IS the conventional form — `id_token` reduces to `JWT` —
 * yields no prefix, and the kits gate their check on the prefix being defined,
 * so a kit-side assertion silently does not run for it.
 */
export const assertCallerTokenType = ({
  wire,
  tokenType,
  typ,
  format,
}: {
  wire: TokenWire;
  /** The type the caller asserted, or nothing. */
  tokenType: string | undefined;
  /** The type header the token carries in its protected bucket, whole. */
  typ: string | undefined;
  /** The token's own format, whose family the asserted type is spelled in. */
  format: TokenFormat;
}): void => {
  if (tokenType === undefined) return;

  const expected = wire.assertedTyp(tokenType, format);

  if (typ === expected) return;

  throw new AegisDomainError("Invalid token", {
    code: "token_type_mismatch",
    data: { typ },
    debug: { expected, format, tokenType },
    title: "Token Type Mismatch",
    details:
      "The token's type header does not match the tokenType asserted for this verification.",
  });
};
