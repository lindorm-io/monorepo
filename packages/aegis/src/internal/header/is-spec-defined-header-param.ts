import { isString } from "@lindorm/is";
import { HEADER_SPECS, headerByJose, headerJoseName } from "./header-registry.js";

/**
 * JOSE header parameters a PUBLIC SPECIFICATION defines and aegis does not
 * implement — the only part of "is this name spec-defined" that cannot be
 * derived from this repository, because it is a fact about IANA's registry.
 *
 * Source: the IANA JOSE Header Parameters registry,
 * https://www.iana.org/assignments/jose/web-signature-encryption-header-parameters.csv
 * taken 2026-08-19. ⚠ THAT URL AND DATE ARE UNCHECKED — nothing in this repo can
 * confirm the committed snapshot came from IANA, and the sha256 the test asserts
 * proves only that the file has not changed since it was committed.
 *
 * ⭐ WHAT IS LOAD-BEARING is the DERIVATION: `is-spec-defined-header-param.test.ts`
 * computes the expected contents of this set FROM that snapshot — every registered
 * name the header registry does not answer for, no more and no less — so a name
 * aegis starts implementing, or an entry typed by hand, fails the test rather than
 * silently opening a hole. Refreshing the snapshot is the manual step; keeping this
 * set in step with it is not.
 *
 * ⛔ MEMBERSHIP HERE IS NOT SUPPORT. Each of these is refused from `custom` and
 * from `crit`; none is emittable. `iss`/`sub`/`aud` are the reason the
 * distinction matters: RFC 7519 §5.3 defines them as unencrypted replicas of the
 * claims, which a recipient "SHOULD verify that their values are identical"
 * against the claims set — so a forged one is a confusion attack, not an inert
 * hint, and `header` cannot express them either.
 */
const UNIMPLEMENTED_SPEC_PARAMS: ReadonlySet<string> = new Set([
  // RFC 7519 §10.4.1 — unencrypted replicas of the claims of the same name.
  "iss",
  "sub",
  "aud",
  // RFC 7797 §3 — the unencoded-payload option.
  "b64",
  // RFC 8225 §8.1 — PASSporT extension identifier.
  "ppt",
  // RFC 8555 §6.4.1 / §6.5.2 — ACME request URL and anti-replay nonce.
  "url",
  "nonce",
  // RFC 9321 — signed vouchers for timestamps.
  "svt",
  // RFC 6749 — the OAuth client identifier, registered for JOSE use.
  "client_id",
  // OpenID Federation 1.0 §4.3 / §4.4.
  "trust_chain",
  "peer_trust_chain",
  // OpenID for Verifiable Presentations 1.0 §12.
  "jwt",
  // IHE ITI Document Signature §5.10.
  "iheSSId",
]);

/**
 * Is this name a header parameter A PUBLIC SPECIFICATION defines, rather than one
 * a producer may invent? The ONE answer to that question, read by both sides that
 * ask it:
 *
 *   - `internal/utils/validate-crit.ts` — RFC 7515 §4.1.11 forbids `crit` to name
 *     one ("Producers MUST NOT include Header Parameter names defined by this
 *     specification or [JWA] for use with JWS […] in the 'crit' list").
 *   - `internal/header/build-custom-header.ts` — the `custom` bag carries
 *     UNREGISTERED parameters, and a spec-defined name is not one.
 *
 * ⛔ ONE PREDICATE, NEVER TWO LISTS. Split the question in two — a hand-written
 * IANA set beside the header registry — and the halves answer differently: the
 * one `custom` reads admits a name the one `crit` reads refuses, so aegis mints
 * tokens no declaration can make it read back — a MALFORMED verdict, which the
 * recipient's `crit` declaration does not reach.
 *
 * ⭐ THE REGISTRY HALF READS THE `spec` COLUMN, which is exactly this question
 * asked of a parameter aegis implements — and it is MACHINE-CHECKED against the
 * committed RFC corpus (`internal/registry/spec-citations.test.ts`), so it cannot
 * drift into prose. `kind: "policy"` is a row saying "lindorm's own rule, nothing
 * to cite", which today is `oid` alone.
 *
 * ⛔ NOT `critEligible`. That column answers "may a producer name this in
 * `crit`", which is a DIFFERENT question that merely coincides today. RFC 7797 §6
 * is the standing counterexample — "The 'crit' Header Parameter MUST be included
 * with 'b64' in its set of values" — so implementing `b64` would require
 * `critEligible: true` on a parameter RFC 7797 defines, and a predicate reading
 * that column would answer `false` for it and reopen the hole this one closes.
 */
// ⚠ `boolean`, NEVER `name is string`. A type predicate also narrows the FALSE
// branch, and this function returns false for most strings — so `is string` told
// the compiler a non-spec-defined name was NOT a string. In `validate-crit.ts`,
// where the argument is already `string`, that made the false branch `never` and
// every later check dead per the type system (`tsc` allows it; the type-aware
// lint rule is what says so).
export const isSpecDefinedHeaderParam = (name: unknown): boolean => {
  if (!isString(name)) return false;

  const spec = headerByJose(name);

  if (spec !== undefined) return spec.spec.kind !== "policy";

  return UNIMPLEMENTED_SPEC_PARAMS.has(name);
};

/** The unimplemented set, exported for the binding test beside this file. */
export const unimplementedSpecParams = (): ReadonlyArray<string> => [
  ...UNIMPLEMENTED_SPEC_PARAMS,
];

/** Every JOSE name the header registry answers for — derived, never mirrored. */
export const registeredJoseNames = (): ReadonlyArray<string> =>
  HEADER_SPECS.map((spec) => headerJoseName(spec));
