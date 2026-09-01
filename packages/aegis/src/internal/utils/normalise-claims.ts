import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { omitNotStated } from "../claims/omit-not-stated.js";
import { pruneEmptyClaims } from "../claims/prune-empty-claims.js";
import { refuseEmptyClaims } from "../claims/refuse-empty-claims.js";

/**
 * The single normalisation applied to a claims dict just before it is serialised
 * — shared by JOSE and COSE so both wires behave identically. THREE steps, none
 * of them a choice:
 *
 *   1. ABSENCE, before the registry is consulted. `undefined` at every depth:
 *      neither wire may carry it, and cbor2 writes a nested one as CBOR simple
 *      value 23 (RFC 8949 §3.3) where `JSON.stringify` writes an array element's
 *      as `null` — pinned in `normalise-claims.test.ts`, "should strip a nested
 *      undefined from a custom claim at the raw CWT door". `null` at the claim
 *      KEY, registered or not ({@link omitNotStated}): a nullable column is the
 *      absent property of the bag, so no aegis door writes a top-level null. A
 *      NESTED null is a member, and members are the walker's
 *      (`internal/claims/translate.ts`); a raw door has no walker and carries it
 *      as written.
 *   2. The empty value of a claim whose registry entry says that empty value can
 *      be neither emitted nor dropped ({@link refuseEmptyClaims}).
 *   3. The empty value of a claim whose registry entry says that empty value
 *      carries nothing ({@link pruneEmptyClaims}). Per CLAIM, top level only, and
 *      a key the registry does not know is never touched.
 *
 * "Empty" to steps 2 and 3 is what a wire can spell — `""`, `[]`, `{}`, an empty
 * `Map`/`Set` — as `isClaimSatisfied` judges it; a `keep` cell writes it as given.
 *
 * ⚠ THE ABSENCE STRIP MUST STAY FIRST. `isClaimSatisfied` is `false` of `null`
 * and of `undefined`, so a refusal reached before it would answer a bag that
 * merely OMITS the claim — and `raw-sign-jws.ts` / `raw-sign-cose.ts` hand this
 * function the caller's own un-translated bag, in which `{ amr: undefined }` and
 * `{ cnf: null }` genuinely arrive.
 * ⚠ THE REFUSAL AND THE PRUNE ARE INTERCHANGEABLE: they read the same `whenEmpty`
 * cell for DIFFERENT answers, so no claim is reached by both.
 * ⛔ Widen either from its exact answer to "anything but keep" and that
 * independence is gone.
 *
 * ⚠ THE REGISTRY DECIDES, NOT THE CALLER, and that is the whole point. Whether an
 * empty value is a statement or noise is a fact about the CLAIM — an empty RFC
 * 9396 `actions` grants no action while an absent one is not restricted by action
 * at all, and an `amr: []` asserts that the authentication methods are known and
 * none applied, which no issuer means. A caller-facing mode made that per-CALL
 * what is per-CLAIM: the same `amr: []` was emitted or dropped depending on a knob
 * the issuer set for unrelated reasons, so the token said two different things
 * about the subject with nothing on the wire to tell them apart. The registry's
 * `whenEmpty` cell answers it once, for everyone, and is pinned by name in
 * `claims-registry.test.ts`.
 */
export const normaliseClaims = <T extends Dict = Dict>(dict: T): T => {
  const stripped = omitNotStated(omitUndefined(dict));

  refuseEmptyClaims(stripped);

  return pruneEmptyClaims(stripped);
};
