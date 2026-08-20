import type { Dict } from "@lindorm/types";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { claimByCoseName, claimByJose } from "./claims-registry.js";

/**
 * Drop the claims whose EMPTY value the registry says carries nothing — the
 * second half of {@link normaliseClaims}, and the payload-side twin of
 * `internal/header/prune-empty-headers.ts`. Both are registry-driven and both run
 * on the write side only; the header one keys by JOSE name alone, because a
 * header bag never reaches an emission boundary cose-keyed.
 *
 * TWO rules, and the registry decides both:
 *
 *   1. A REGISTERED claim is pruned when its value is empty and its
 *      {@link ClaimSpec.whenEmpty} cell says `"prune"`. The cell is required, so
 *      every claim has answered; there is no fallback for a claim to land in.
 *   2. An UNREGISTERED key is NEVER pruned. A raw kit-sign wire dict and an
 *      opaque payload have no registry entry, and aegis does not reshape what it
 *      has not declared — that is what keeps the opaque door honest, and it is
 *      why this replaced a hardcoded protected-key set: the set could only ever
 *      name the exceptions it had thought of.
 *
 * TOP LEVEL only, deliberately — and the reason CHANGED once the registry
 * learned to describe a structure. It used to be that a claim's inner members
 * were undeclared, so recursing here would have been rule 2 broken one level
 * down. A claim whose codec declares `children` now states a `whenEmpty` verdict
 * for each member, and that verdict is honoured where the structure is BUILT
 * (`internal/claims/translate.ts`), not here: the translator is the only place
 * that knows which member a key is, and by the time a bag reaches this boundary
 * it is WIRE-KEYED — a key here is a wire name, and resolving it back to a
 * member would mean re-deriving what the translator has already decided. (The
 * bag is not FLAT: a structured claim's value is a nested object at this
 * boundary. What is true is that this walk visits the TOP LEVEL only.) So the
 * two levels are answered in two places on purpose, and this one still walks the
 * top level alone — which keeps rule 2 intact for the members that remain
 * undeclared (an RFC 9396 `actions` array, an RFC 8417 event payload).
 *
 * The dict is walked, not the registry, so insertion ORDER survives — the wire
 * bytes are order-sensitive and the corpus pins them. The registry is still the
 * authority; it is simply consulted per key rather than iterated.
 *
 * Both wire vocabularies resolve: the JOSE name (`JwtKit.sign` is handed a
 * jose-keyed dict) and the COSE name (`signCwt` a cose-keyed one, where RFC 8392
 * renames `jti` to `cti`). Those are the only two spellings a claims dict reaches
 * the emission boundary in.
 *
 * ⛔⛔ `Object.fromEntries`, NEVER `result[key] = value`. THE KEYS ARE THE
 * CALLER'S, and a wire door takes an already-wire dict VERBATIM — `JwtKit.sign`,
 * `CwtKit.sign` and `signCwt` do no case conversion, so a service that built its
 * claims with `JSON.parse` hands an own `__proto__` straight to this line.
 * `@lindorm/utils`'s `omitFromObject` runs first and deliberately PRESERVES that
 * key (`omit-from-object.ts:32`), so it arrives live, and a plain assignment then
 * makes it this result's PROTOTYPE.
 *
 * ⚠ THE CONSEQUENCE IS A FORGED CLAIM ON A SIGNED TOKEN, not a dropped one. The
 * COSE claims codec reads registered claims off this bag BY PROPERTY, so an
 * inherited `aud`/`cti` is encoded as though the issuer had stated it. Measured
 * through the public kit doors before the repair, with
 * `{"iss":"https://good.example/","sub":"u1","__proto__":{"cti":"forged-token-id","aud":"https://victim.example/"}}`:
 *   `CwtKit.decode(cwt.sign(claims)).payload` ->
 *     `{iss, sub, aud:"https://victim.example/", cti:"forged-token-id"}`
 *   `JwtKit.decode(jwt.sign(claims)).payload` -> `{iss, sub}`
 * — a signed CWT naming an audience its issuer never wrote, and the two wires
 * disagreeing about the same input. `fromEntries` DEFINES each key, so
 * `__proto__` stays an ordinary own property on both.
 * pinned: prune-empty-claims.test.ts, and end to end in `claims-proto-forgery.test.ts`.
 */
export const pruneEmptyClaims = <T extends Dict = Dict>(dict: T): T =>
  Object.fromEntries(
    Object.entries(dict).filter(([key, value]) => {
      const spec = claimByJose(key) ?? claimByCoseName(key);

      // `!isClaimSatisfied`, not a bare `isEmpty`: this is the same emptiness the
      // profile floor asks about, and `is-claim-satisfied.ts` cites this column as
      // agreeing with it — so the two must not be able to drift apart.
      return !(spec?.whenEmpty === "prune" && !isClaimSatisfied(value));
    }),
  ) as T;
