import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { buildMediaType } from "./compute-typ-header.js";

/**
 * The TYP ASSERTION both claims kits run when the caller states a `tokenType`:
 * the header's `typ` must be the media type that bare PREFIX builds on THIS
 * format. A `cwt` caller asking for `at` expects `application/at+cwt`; a `jwt`
 * one expects `application/at+jwt`. The kit knows its own format, so the caller
 * passes the prefix and never the full media type.
 *
 * ⚠ Distinct from `assertWireTyp`, and both run. `assertWireTyp` asks whether
 * the typ is WELL-FORMED for the wire at all (a JWE cannot be read as a JWT);
 * this asks whether it is the ONE the caller demanded. A stated `tokenType` is a
 * caller policy, so an absent one asserts nothing.
 */
export const assertTokenTypeMatch = ({
  typ,
  tokenType,
  format,
  error,
}: {
  /** The typ the header carries, whole. */
  typ: string | undefined;
  /** The bare type PREFIX the caller demanded, or nothing. */
  tokenType: string | undefined;
  /** The wire format tag: it builds the media type AND namespaces the refusal. */
  format: TokenFormatTag;
  error: typeof AegisError;
}): void => {
  if (tokenType === undefined) return;

  const expected = buildMediaType(tokenType, format);

  if (typ === expected) return;

  throw new error("Invalid token", {
    code: `${format}_typ_mismatch`,
    data: { typ },
    debug: { expected },
    title: `${format.toUpperCase()} Typ Mismatch`,
    details: "The header typ does not match the typ expected during verification.",
  });
};
