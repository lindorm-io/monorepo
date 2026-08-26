import type { Dict } from "@lindorm/types";
import { isClaimSatisfied } from "../utils/rules/is-claim-satisfied.js";
import { claimByCoseName, claimByJose } from "./claims-registry.js";

/**
 * Drop the claims whose EMPTY value the registry says carries nothing — the
 * pruning step of {@link normaliseClaims}, and the payload-side twin of
 * `internal/header/prune-empty-headers.ts`.
 *
 * TWO rules, and the registry decides both:
 *
 *   1. A REGISTERED claim is pruned when its value is empty and its
 *      {@link ClaimSpec.whenEmpty} cell says `"prune"`. The cell is required, so
 *      every claim has answered; there is no fallback for a claim to land in.
 *   2. An UNREGISTERED key is NEVER pruned. A raw kit-sign wire dict and an
 *      opaque payload have no registry entry, and aegis does not reshape what it
 *      has not declared — which is what keeps the opaque door honest.
 *
 * ⚠ TOP LEVEL only. A member's own `whenEmpty` verdict is honoured where the
 * structure is BUILT (`internal/claims/translate.ts`): the translator is the only
 * place that knows which member a key is, and a bag reaching this boundary is
 * WIRE-KEYED, so resolving a key back to a member would re-derive what the
 * translator already decided. (The bag is not FLAT — a structured claim's value is
 * a nested object here — only this walk is.)
 *
 * The DICT is walked, not the registry, so insertion ORDER survives; the wire
 * bytes are order-sensitive and the corpus pins them. Both wire vocabularies
 * resolve — the JOSE name and the COSE name (RFC 8392 §3.1.7 keys `jti` as `cti`) —
 * and those are the only two spellings a claims dict reaches emission in.
 *
 * ⛔⛔ `Object.fromEntries`, NEVER `result[key] = value`. THE KEYS ARE THE
 * CALLER'S, and a wire door takes an already-wire dict VERBATIM — `JwtKit.sign`,
 * `CwtKit.sign` and `signCwt` do no case conversion, so a service that built its
 * claims with `JSON.parse` hands an own `__proto__` straight to this line, and
 * `@lindorm/utils`'s `omitFromObject` runs first and PRESERVES it (it writes with
 * `Object.defineProperty`), so a plain assignment here makes it this result's
 * PROTOTYPE.
 *
 * ⚠ THE CONSEQUENCE IS A FORGED CLAIM ON A SIGNED TOKEN, not a dropped one: the
 * COSE claims codec reads registered claims off this bag BY PROPERTY, so an
 * inherited `aud`/`cti` is encoded as though the issuer had stated it.
 * `fromEntries` DEFINES each key, so `__proto__` stays an ordinary own property.
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
