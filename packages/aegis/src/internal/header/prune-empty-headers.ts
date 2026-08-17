import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { headerByJose } from "./header-registry.js";

/**
 * Drop the header parameters whose EMPTY value the registry says carries nothing
 * — the second half of {@link normaliseHeaders}, and the header-side twin of
 * `internal/claims/prune-empty-claims.ts`.
 *
 * TWO rules, and the registry decides both:
 *
 *   1. A REGISTERED parameter is pruned when its value is empty and its
 *      {@link HeaderSpec.whenEmpty} cell says `"prune"`. The cell is required, so
 *      every one of the twenty-one has answered; there is no fallback for a
 *      parameter to land in. Twenty prune; `x5t#S256` REFUSES, because it is the
 *      one parameter aegis's verify BINDS on and an empty binding can be neither
 *      dropped nor emitted — that verdict is `refuse-empty-headers.ts`'s, and it
 *      throws before this function ever sees the bag.
 *   2. An UNREGISTERED key is NEVER pruned. There is no cell to read: the
 *      registry is what says whether an empty value carries anything, and a key
 *      with no entry has not answered. The closed-set rule is what disposes of
 *      it instead — DROPPED by the two JOSE passes, REFUSED with
 *      `header_no_cose_label` by the COSE one (`internal/utils/token-header.ts`).
 *
 *      ⚠ On COSE that composes into an asymmetry worth stating, because it looks
 *      like one rule being inconsistent and is two rules meeting. Measured
 *      through `buildCoseHeaders`: `{ apu: "x" }` and `{ nonsense: "" }` both
 *      throw `header_no_cose_label`, while `{ apu: "" }` and `{ zip: "" }` emit
 *      nothing and no refusal. So whether a caller hears "COSE cannot carry this"
 *      depends on whether aegis has heard of the parameter — and that is correct:
 *      an unregistered key is untouched by THIS rule and survives to the closed-
 *      set refusal, while a REGISTERED parameter whose empty value the registry
 *      prunes has nothing left to refuse. A parameter that emits nothing is not a
 *      parameter, on either wire.
 *
 *      The prune is deliberately blind to which wire is being built. Making it
 *      spare a registered-but-COSE-absent parameter so the refusal survives would
 *      be the prune second-guessing an encoder it cannot see, and would split
 *      "empty" into a JOSE meaning and a COSE one — the wire asymmetry an
 *      attacker picks the encoding to exploit.
 *
 * ⚠ NO `crit` EXEMPTION, and there is nothing left for one to do. A parameter a
 * message's `crit` names is REFUSED for being empty before any of this matters —
 * `assert-crit-satisfied.ts`, at both builders — so the prune can never take a
 * value something still points at. The exemption that used to live here tried to
 * carry a referent past the prune instead, and it had to be told which bag, which
 * bucket, which tier and which vocabulary it was reasoning about; each answer was
 * one more thing to get right and four of them were got wrong. Refusing the
 * contradiction where it is MADE leaves this function with nothing to know about
 * the message it is a fragment of.
 *
 * TOP LEVEL only, deliberately. A registered parameter's inner members are its
 * own declared structure (a JWK's coordinates, an `x5c` chain's certificates, a
 * `crit` list's members) which the registry does not describe, so recursing would
 * be rule 2 broken one level down.
 *
 * The dict is walked, not the registry, so insertion ORDER survives — the wire
 * bytes are order-sensitive and the corpus pins them. The registry is still the
 * authority; it is simply consulted per key rather than iterated.
 *
 * ⚠ JOSE-KEYED ONLY, and one lookup is therefore enough. Every write-side header
 * bag is already spelled in JOSE names by the time it reaches a normalisation
 * point — `mapTokenHeader` writes `headerJoseName(spec)`, `shapeWireHeader` takes
 * a wire-named bag, and `wireHeaderToCoseMap` takes a wire-named bag and resolves
 * the COSE labels afterwards. Contrast `pruneEmptyClaims`, which must try both
 * spellings because a COSE claims dict arrives cose-keyed.
 *
 * ⚠ What `isEmpty` calls empty is what governs here: `""`, `null`, `undefined`,
 * `[]`, `{}` and a zero-size `Map`/`Set`. NOT `0`, NOT `false`, and NOT a
 * zero-length Buffer — so `p2c: 0` is an iteration count that must fail where the
 * derivation happens, and a zero-length nonce is a crypto-layer defect that must
 * fail in the AEAD, neither of them a parameter this quietly removes.
 */
export const pruneEmptyHeaders = <T extends Dict = Dict>(dict: T): T => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    const spec = headerByJose(key);

    if (spec?.whenEmpty === "prune" && isEmpty(value)) continue;

    result[key] = value;
  }

  return result as T;
};
