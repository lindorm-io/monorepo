import { isArray, isString } from "@lindorm/is";
import type { CoseError } from "../../errors/index.js";
import type { TokenFormatTag, WireTokenHeader } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { assertCritEligible } from "./assert-crit-eligible.js";
import { coseWireKey, joseByCose } from "./header-registry.js";
import { isProtectedOnly } from "./is-protected-only.js";
import { normaliseHeaders } from "./normalise-headers.js";
import { wireHeaderToCoseMap } from "../utils/token-header.js";

/**
 * Translate and VALIDATE the two caller-controlled COSE header bags (`header` →
 * protected, `unprotected` → unprotected) into COSE integer-label maps, enforcing
 * the crit-eligibility gate and the four RFC-9052 / COSE-consistency rules (all
 * throw at the site, house
 * idiom). It returns the translated entries for the kit to merge into its
 * already-derived protected/unprotected maps — the ordering of the merge is the
 * kit's concern (COSE_Encrypt0 finalizes its protected header before the IV
 * exists, so it cannot be a single write here).
 *
 * `reserved` is the kit's own `KitCapabilities.reserved` row — the JOSE wire
 * names of the parameters the kit stamps itself (a signed kit: `alg`+`kid`+`typ`;
 * the encrypt kit: `alg`/label-1 + `kid` + `iv` + `typ`) — resolved to COSE labels
 * here. It is the runtime backstop for the type-level Omit, since an `as
 * any`/untyped dict can smuggle a derived param past the compiler, and taking it
 * from the capability table rather than a hand-built set is what stops a kit's
 * declared capability and its enforcement from drifting apart.
 *
 * The rules:
 *  1. a reserved/derived param set in EITHER bag → throw (it is key-derived);
 *  2. `crit` ⊆ protected — `crit` itself, or any param it lists, placed in the
 *     unprotected bag → throw (critical params must be integrity-protected);
 *  3. the same param in BOTH bags → throw (COSE cannot carry it twice);
 *  4. a parameter the header registry declares `placement: "protected"` placed in
 *     the unprotected bag → throw (aegis decides the bucket, not the caller).
 *
 * ⚠ THE CRIT-ELIGIBILITY GATE RUNS FIRST, ahead of all four
 * ({@link assertCritEligible}). "May this name stand in a `crit` at all" is
 * prior to "is it in the right bucket": a `crit: ["alg"]` beside an unprotected
 * `alg` is a header no producer may write on either wire, and answering it with
 * a PLACEMENT complaint would tell the caller to move a parameter it must
 * instead stop naming. It also runs on the WIRE-NAMED bag here, before any label
 * translation, which is what keeps it out of the label/name question entirely —
 * see its own docstring.
 *
 * ⚠ Rule 4 runs LAST, after the structural ones. Rules 1-3 name facts about the
 * COSE wire itself — a key-derived parameter, RFC 9052 §3.1's crit requirement, a
 * structure that cannot carry one label twice — and rule 4 states an aegis
 * POLICY, so the wire's own constraints are reported before ours. It also keeps
 * rule 3 reachable and honestly probed: with rule 4 first, `{ header: { cty },
 * unprotected: { cty } }` would refuse for placement and the duplicate rule would
 * be checked by nothing.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER, so BOTH bags are
 * NORMALISED ONCE at the top and ALL FOUR rules then run over the normalised
 * bags. That is the rule this file already applied to `undefined` — an absent
 * parameter is neither reserved, nor critical, nor a duplicate, nor misplaced,
 * because nothing about it reaches either bucket — widened by
 * {@link normaliseHeaders} to "`undefined`, or empty where the registry says
 * prune". One rule, both wires (`build-jose-header.ts` normalises the same way,
 * before its reserved check), every guard.
 *
 * ⚠ Nothing that emits BYTES stops being guarded: the prune removes only what
 * would have gone on the wire as noise, and a `whenEmpty: "keep"` cell would
 * survive it intact (no header parameter holds one today). The one `refuse` cell
 * never reaches the rules at all — the normalisation THROWS for it. And a
 * normalisation ahead of the rules is what keeps the two wires agreeing on what
 * "emits nothing" means: refusing on COSE what JOSE silently drops (or the
 * reverse) is a wire asymmetry an attacker chooses the encoding to exploit.
 *
 * ⚠ THE NORMALISATION NARROWS EVERY RULE'S REACH, AND THAT IS THE WHOLE CLASS —
 * state it once here rather than leave five separate surprises to be rediscovered
 * one refusal at a time. For a REGISTERED parameter whose `whenEmpty` cell says
 * prune, an empty value now emits nothing and therefore triggers nothing:
 * `cose_reserved_header`, `cose_duplicate_header`, `cose_unprotected_placement`,
 * `cose_crit_unprotected`, `cose_crit_param_unprotected` and
 * `header_no_cose_label` all fall silent, as does `jose_reserved_header` on the
 * twin. Measured through this function: `{apu: ""}`, `{zip: ""}`, `{x5c: []}`,
 * `unprotected: {cty: ""}`, `unprotected: {crit: []}` and `{ crit: ["oid"] }`
 * beside `unprotected: { oid: "" }` each return two maps with no refusal from any
 * rule here. That is the rule, not six exceptions to it — a refusal names a
 * statement the caller made about the token, and a parameter that emits no bytes
 * made none. What survives is where bytes or a REFERENT survive: an UNREGISTERED
 * key is never pruned, so `{nonsense: ""}` still throws `header_no_cose_label`,
 * and the one `whenEmpty: "refuse"` cell (`x5t#S256`) is answered by the
 * normalisation itself with `header_empty_parameter` rather than reaching any
 * rule below.
 *
 * ⚠ `crit` IS THE ONE PLACE A REFERENT OUTLIVES THE PRUNE, and it is answered by
 * REFUSING rather than by exempting — but NOT HERE. The refusal needs the FINISHED
 * protected bucket, and this function only has the caller's half of it, so it
 * lives at the end of `mergeCoseProtected` ({@link assertCritSatisfied}), the
 * COSE analogue of `buildJoseHeader`'s last line. That is why the last row above
 * returns cleanly from here: `{ header: { crit: ["oid"] }, unprotected: { oid: "" } }`
 * used to reach `cose_crit_param_unprotected` by way of an exemption that carried
 * the empty value into the unprotected bucket, and now travels one step further to
 * be refused as the empty value it is. Rule 2 still owns the case with a REAL
 * value in the wrong bucket, and owns it here, which is why the accurate refusal
 * still comes first.
 */
export const buildCoseHeaders = ({
  reserved,
  header,
  unprotected,
  proprietary,
  format,
  error,
}: {
  reserved: ReadonlyArray<string>;
  header: Partial<WireTokenHeader> | undefined;
  unprotected: Partial<WireTokenHeader> | undefined;
  /**
   * The caller's INTEROP MODE, forwarded to the label resolver: it decides
   * whether a private-use parameter is keyed by its compact integer or by its
   * interoperable string label. It reaches the reserved set through the same
   * resolver, so the guard below compares the spelling actually written.
   */
  proprietary: boolean | undefined;
  /** The wire format tag, which namespaces the crit-eligibility refusal's code. */
  format: TokenFormatTag;
  error: typeof CoseError;
}): {
  protectedEntries: Map<CoseLabel, unknown>;
  unprotectedEntries: Map<CoseLabel, unknown>;
} => {
  // A parameter that emits nothing is not a parameter — see the docstring. Both
  // bags are normalised HERE, once, so all four rules below see the same values
  // the wire will, and neither wire refuses what the other silently drops.
  const headerBag = normaliseHeaders(header ?? {});
  const unprotectedBag = normaliseHeaders(unprotected ?? {});

  // The NAME-side crit gate, ahead of all four rules and on the WIRE-NAMED bag —
  // see the docstring and `assert-crit-eligible.ts`.
  assertCritEligible({ header: headerBag, format, error });

  // Rule 2 — crit ⊆ protected (RFC 9052 §3.1). Checked on the wire-named bags,
  // BEFORE label translation, which is why it compares JOSE names on both sides:
  // a caller writes `crit: ["oid"]` and `oid: "1.2.3.4"` in the same vocabulary.
  // `wireHeaderToCoseMap` then translates the members to the integer labels the
  // parameters are keyed under, because on the wire a crit member IS a label.
  if (Object.hasOwn(unprotectedBag, "crit")) {
    throw new error("crit cannot be an unprotected COSE header parameter", {
      code: "cose_crit_unprotected",
      title: "COSE crit Must Be Protected",
      details:
        "RFC 9052 requires critical header parameters to be integrity-protected, so crit itself must live in the protected header, not the unprotected one.",
    });
  }

  // ⚠ `Object.hasOwn`, never `in`: the member is CALLER-CONTROLLED and `in`
  // resolves through `Object.prototype`, so `crit: ["toString"]` matched a
  // parameter no bag holds and this rule refused a token that has no unprotected
  // bucket at all. `in` on a caller-influenced key is a BANNED construct in this
  // package. It is also what restored the rule's reach: the loop used to be gated
  // on the caller having SUPPLIED an unprotected bag, and the normalisation above
  // now makes that bag `{}` rather than `undefined` — an own-key test on an empty
  // object states the same thing without a second condition to keep in step.
  const crit = headerBag.crit;
  if (isArray(crit)) {
    for (const name of crit) {
      if (isString(name) && Object.hasOwn(unprotectedBag, name)) {
        throw new error(`crit-listed parameter "${name}" cannot be unprotected`, {
          code: "cose_crit_param_unprotected",
          data: { parameter: name },
          title: "COSE crit Parameter Must Be Protected",
          details:
            "A parameter named in crit must be integrity-protected, so it cannot be placed in the unprotected header bucket.",
        });
      }
    }
  }

  // These re-normalise, idempotently — the entries are built from the same bags
  // the rules were checked on, so nothing can be added or removed between the
  // verdict and the wire.
  const protectedEntries = wireHeaderToCoseMap(headerBag, proprietary);
  const unprotectedEntries = wireHeaderToCoseMap(unprotectedBag, proprietary);

  // ⚠ Resolved in the SAME interop mode the entries were, not as integer labels:
  // a reserved parameter that ever landed in the private-use range would be
  // spelled by its string label on an interoperable token, and a set of integers
  // would then match nothing — the guard would pass a caller-supplied
  // key-derived parameter straight onto the wire. None is private-use today, so
  // this is the mode agreeing with itself rather than a behaviour.
  const reservedLabels = new Set<CoseLabel>(
    reserved.map((jose) => coseWireKey(jose, proprietary)),
  );

  // Rule 1 — a kit-derived/computed param cannot be set by the caller in EITHER
  // bag (the runtime backstop for untyped paths; the bag TYPES already Omit these).
  for (const [entries, bucket] of [
    [protectedEntries, "header"],
    [unprotectedEntries, "unprotected"],
  ] as const) {
    for (const label of entries.keys()) {
      if (!reservedLabels.has(label)) continue;
      const jose = joseByCose(label) ?? String(label);
      throw new error(`Header parameter "${jose}" is key-derived and cannot be set`, {
        code: "cose_reserved_header",
        data: { parameter: jose, bucket },
        title: "COSE Reserved Header Parameter",
        details:
          "This header parameter is derived from the signing/encrypting key or computed by the crypto operation, so the kit always sets it; it cannot be supplied in the header or unprotected bag.",
      });
    }
  }

  // Rule 3 — the same non-reserved param cannot appear in BOTH buckets.
  for (const label of protectedEntries.keys()) {
    if (!unprotectedEntries.has(label)) continue;
    const jose = joseByCose(label) ?? String(label);
    throw new error(`Header parameter "${jose}" set in both header and unprotected`, {
      code: "cose_duplicate_header",
      data: { parameter: jose },
      title: "COSE Duplicate Header Parameter",
      details:
        "A header parameter may live in the protected or the unprotected bucket, not both; COSE cannot carry the same parameter twice.",
    });
  }

  // Rule 4 — the registry's PLACEMENT column, the same datum the read-side merge
  // consults (`is-protected-only.ts`). Checked on the wire-named bag, like rule
  // 2, because that is the vocabulary `placement` is keyed in.
  //
  // ⚠ It reads the NORMALISED bag, like every rule here. Rule 4 asks where a
  // parameter TRAVELS, and a pruned parameter travels nowhere: it emits no bytes
  // and nothing else in the message points at it, so there is no statement left
  // to be in the wrong bucket.
  //
  // An unprotected `typ` is the shape that makes this load-bearing, and it is the
  // one member of the set a SPECIFICATION decides rather than the placement
  // column: RFC 9596 §2 — *"The "typ" parameter MUST NOT be present in
  // unprotected headers."* It is an unauthenticated type declaration on a token
  // that otherwise verifies. Today the kits reserve `typ`, so rule 1 catches that
  // one — but `cty`, `oid`, `x5c` and `x5u` are all caller-settable and were all
  // accepted into the unauthenticated bucket.
  for (const jose of Object.keys(unprotectedBag)) {
    if (!isProtectedOnly(jose)) continue;

    throw new error(`Header parameter "${jose}" cannot be unprotected`, {
      code: "cose_unprotected_placement",
      data: { parameter: jose, placement: "protected" },
      title: "COSE Header Parameter Must Be Protected",
      details:
        "aegis decides which bucket a header parameter travels in, and this one is integrity-protected only: a recipient must be able to rely on it, so it cannot be placed in the unprotected bucket where any holder of the token could rewrite it.",
    });
  }

  return { protectedEntries, unprotectedEntries };
};
