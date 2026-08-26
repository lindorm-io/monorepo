import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { headerByJose } from "./header-registry.js";

/**
 * Drop the header parameters whose EMPTY value the registry says carries nothing
 * — the pruning step of {@link normaliseHeaders}, and the header-side twin of
 * `internal/claims/prune-empty-claims.ts`.
 *
 * ⚠ AN UNREGISTERED KEY IS NEVER PRUNED: there is no cell to read, so it has not
 * answered. The closed-set rule disposes of it instead — DROPPED by the two JOSE
 * passes, REFUSED with `header_no_cose_label` by the COSE one
 * (`internal/utils/token-header.ts`).
 *
 * ⚠ ON COSE THAT COMPOSES INTO AN ASYMMETRY that reads like one inconsistent rule
 * and is two rules meeting: through `buildCoseHeaders`, `{ apu: "x" }` and
 * `{ nonsense: "" }` both throw `header_no_cose_label`, while `{ apu: "" }` emits
 * nothing and no refusal. ⛔ The prune is blind to which wire is being built and
 * must stay so — sparing a registered-but-COSE-absent parameter to keep the refusal
 * alive would split "empty" into a JOSE meaning and a COSE one, which is the wire
 * asymmetry an attacker picks the encoding to exploit.
 *
 * ⚠ NO `crit` EXEMPTION and nothing left for one to do — see
 * `normalise-headers.ts`.
 *
 * ⚠ TOP LEVEL and JOSE-KEYED. A registered parameter's inner members are its own
 * declared structure (a JWK's coordinates, an `x5c` chain) which the registry
 * does not describe, so recursing would break the unregistered-key rule one level
 * down; and every write-side bag is spelled in JOSE names by the time a
 * normalisation sees it, so one lookup suffices. Contrast `pruneEmptyClaims`,
 * which must try both spellings because a COSE claims dict arrives cose-keyed.
 *
 * ⚠ The DICT is walked, not the registry, so insertion order survives — the wire
 * bytes are order-sensitive and the corpus pins them.
 *
 * ⚠ `isEmpty` governs, so `0`, `false` and a zero-length Buffer are NOT empty:
 * `p2c: 0` is an iteration count that must fail where the derivation happens and
 * a zero-length nonce is a crypto-layer defect that must fail in the AEAD,
 * neither of them a parameter this quietly removes.
 *
 * ⛔ `Object.fromEntries`, NEVER `result[key] = value`. The keys come off a CALLER's
 * header, `JSON.parse` makes `__proto__` an OWN property that survives
 * `Object.entries`, and assigning it sets this result's PROTOTYPE instead —
 * whereupon it answers for parameters the caller never wrote, because everything
 * downstream reads the normalised bag by property (`JwsKit.sign` takes
 * `callerHeader.cty`, `build-cose-headers.ts` takes `headerBag.crit`).
 * `fromEntries` DEFINES each key, so `__proto__` stays an ordinary own property.
 * pinned: prune-empty-headers.test.ts for the prune; the `__proto__` half in
 * custom-header-params.test.ts, which is the door that reaches it.
 */
export const pruneEmptyHeaders = <T extends Dict = Dict>(dict: T): T =>
  Object.fromEntries(
    Object.entries(dict).filter(([key, value]) => {
      const spec = headerByJose(key);

      return !(spec?.whenEmpty === "prune" && isEmpty(value));
    }),
  ) as T;
