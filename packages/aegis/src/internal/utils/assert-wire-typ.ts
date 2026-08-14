import { isString } from "@lindorm/is";
import type { AegisError } from "../../errors/index.js";

/**
 * The `typ` WELL-FORMEDNESS gate, for every wire that has one.
 *
 * It answers ONE question: does a `typ` the token carries belong to the media
 * type family this reader speaks? A JWS must not be verified as a JWT, a
 * COSE_Sign1 of another shape must not pass as a CWT — so a PRESENT typ is
 * accepted only when it is one of the family's exact spellings (`JWT`, `JWS`,
 * `JOSE`, `JWE`, `application/cwt`) or a structured `<type>+<suffix>` of it.
 *
 * This is NOT the typ MATCH check (does the typ equal the one this call
 * expects?), which lives at the call sites that have an expectation, and NOT the
 * typ PRESENCE policy, which is a domain/profile concern — except on the JWE
 * wire, whose decrypt has always REQUIRED a typ. Hence `presence`.
 *
 * ⚠ The error is fully caller-supplied because each wire already answers in its
 * own words, under its own leaf error class and its own `<format>_invalid_typ`
 * code. Collapsing those would be a behaviour change; only the PREDICATE is
 * shared here.
 */
export const assertWireTyp = ({
  typ,
  accept,
  suffix,
  presence,
  error,
  code,
  title,
  details,
}: {
  /** The typ as the wire carried it; every caller has already refused a non-string. */
  typ: string | undefined;
  /** The exact spellings this family accepts verbatim. */
  accept: ReadonlyArray<string>;
  /** The structured-syntax suffix (RFC 6838 §4.2.8), e.g. `"+jwt"`. */
  suffix: string;
  /** Whether a typ-LESS token is well-formed on this wire. */
  presence: "optional" | "required";
  error: typeof AegisError;
  code: string;
  title: string;
  details: string;
}): void => {
  if (presence === "optional" && typ === undefined) return;

  // ⚠ BEHAVIOUR CHANGE (DEFENSIVE ONLY). The `isString` guard is new: the JwtKit
  // and CWT call sites used to reach straight for `typ.endsWith(...)`, so a
  // non-string typ would have thrown a raw `TypeError` rather than this leaf
  // error. No wire can actually deliver one — the JOSE wires refuse a non-string
  // typ in `decodeJoseHeader` (`jose_header_typ_invalid`) and the COSE wires
  // normalise it to `undefined` in `decodeCwt` — so nothing observable changed;
  // the guard exists so the predicate is answerable for any input it is handed.
  if (isString(typ) && (accept.includes(typ) || typ.endsWith(suffix))) return;

  throw new error("Invalid token", { code, data: { typ }, title, details });
};
