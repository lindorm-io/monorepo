import { isString } from "@lindorm/is";
import { HEADER_SPECS, headerByJose, headerJoseName } from "./header-registry.js";

/**
 * JOSE header parameters a public specification defines and aegis does not
 * implement — the one part of "is this name spec-defined" that cannot be derived
 * from this repository, because it is a fact about IANA's registry.
 *
 * ⚠ THE SNAPSHOT'S PROVENANCE IS UNCHECKED. Nothing here can confirm
 * `src/__fixtures__/iana/` came from IANA; the sha256 the test asserts proves only
 * that the file has not changed since it was committed.
 *
 * ⭐ WHAT IS LOAD-BEARING IS THE DERIVATION: `is-spec-defined-header-param.test.ts`
 * computes this set's expected contents FROM that snapshot, so a name aegis starts
 * implementing — or an entry typed by hand — fails the test rather than silently
 * opening a hole.
 *
 * ⛔ MEMBERSHIP HERE IS NOT SUPPORT. Each name is refused from `custom` and from
 * `crit`, and none is emittable; a forged `iss`/`sub`/`aud` header is a confusion
 * attack rather than an inert hint (RFC 7519 §5.3).
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
  // RFC 8555 §6.4.1 / RFC 8555 §6.5.2 — ACME request URL and anti-replay nonce.
  "url",
  "nonce",
  // RFC 9321 — signed vouchers for timestamps.
  "svt",
  // RFC 6749 — the OAuth client identifier, registered for JOSE use.
  "client_id",
  // OpenID Federation 1.0 §4.3 / OpenID Federation 1.0 §4.4.
  "trust_chain",
  "peer_trust_chain",
  // OpenID for Verifiable Presentations 1.0 §12.
  "jwt",
  // IHE ITI Document Signature §5.10.
  "iheSSId",
]);

/**
 * Is this name a header parameter a public specification defines, rather than one
 * a producer may invent? The ONE answer, read by both sides that ask it:
 *
 *   - `internal/utils/validate-crit.ts` — `crit` may not name one (RFC 7515
 *     §4.1.11).
 *   - `internal/header/build-custom-header.ts` — the `custom` bag carries
 *     UNREGISTERED parameters, and a spec-defined name is not one.
 *
 * ⛔ ONE PREDICATE, NEVER TWO LISTS. Split the question — a hand-written IANA set
 * beside the header registry — and the halves answer differently: the one `custom`
 * reads admits a name the one `crit` reads refuses, so aegis mints tokens no
 * declaration can make it read back.
 *
 * ⭐ The registry half reads the `spec` column; `kind: "policy"` is a row saying
 * "lindorm's own rule, nothing to cite".
 *
 * ⛔ NOT `critEligible`. That column answers "may a producer name this in `crit`",
 * a different question that merely coincides today: `b64` must be named in `crit`
 * wherever it is used (RFC 7797 §6), so implementing it would need
 * `critEligible: true` on a spec-defined parameter, and a predicate reading that
 * column would answer `false` for it.
 */
// ⚠ `boolean`, NEVER `name is string`. A type predicate narrows the FALSE branch
// too, so in `validate-crit.ts` — where the argument is already `string` — it makes
// that branch `never` and every later check dead per the type system (`tsc` allows
// it; the type-aware lint rule is what says so).
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
