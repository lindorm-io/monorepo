import { isArray, isString } from "@lindorm/is";
import type { CoseError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  CoseWireTokenEnvelope,
  TokenFormatTag,
  WireTokenHeader,
} from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { assertCritEligible } from "./assert-crit-eligible.js";
import { buildCustomHeader } from "./build-custom-header.js";
import { joseByCose } from "./header-registry.js";
import { normaliseHeaders } from "./normalise-headers.js";
import { mapTokenHeader, wireHeaderToCoseMap } from "../utils/token-header.js";

/**
 * Translate and VALIDATE the caller-controlled COSE header input — the REGISTERED
 * bag (`header` → protected) and the two UNREGISTERED ones (`custom.protected`,
 * `custom.unprotected`) — into COSE label maps, enforcing the crit-eligibility
 * gate and the COSE-consistency rules (all throw at the site, house idiom). It
 * returns the translated entries for the kit to merge into its already-derived
 * protected/unprotected maps — the ordering of the merge is the kit's concern
 * (COSE_Encrypt0 finalizes its protected header before the IV exists, so it
 * cannot be a single write here).
 *
 * ⚠ A REGISTERED PARAMETER HAS NO CALLER-CHOSEN BUCKET, and that is why `header`
 * has no unprotected twin. Every registered parameter a caller may set declares
 * `placement: "protected"`; the two cells reading `"either"` (`iv`, `kid`) are
 * kit-owned, so a bag meaning "registered params a caller may place unprotected"
 * describes the empty set (`header-registry.ts`, `is-protected-only.ts` — which
 * the READ side still consults for a foreign token that puts one there anyway).
 * An UNREGISTERED parameter has no row, so its bucket is the caller's by
 * necessity, and `custom` is where that choice lives.
 *
 * `reserved` is the kit's own `KitCapabilities.reserved` row — the JOSE wire
 * names of the parameters the kit stamps itself. It is the runtime backstop for
 * the type-level Omit, since an `as any`/untyped dict can smuggle a derived param
 * past the compiler, and taking it from the capability table rather than a
 * hand-built set is what stops a kit's declared capability and its enforcement
 * from drifting apart.
 *
 * The rules:
 *  1. `crit` itself, or any param it lists, placed in the unprotected bag →
 *     throw (RFC 9052 §3.1: critical params must be integrity-protected);
 *  2. a registered or kit-owned name inside either `custom` bag → throw
 *     ({@link buildCustomHeader}); a reserved/derived param in `header` → throw;
 *  3. the same param in BOTH buckets → throw (COSE cannot carry it twice).
 *
 * ⚠ THE CRIT-ELIGIBILITY GATE RUNS AHEAD OF THE PLACEMENT RULES
 * ({@link assertCritEligible}). "May this name stand in a `crit` at all" is prior
 * to "is it in the right bucket": a `crit: ["alg"]` beside an unprotected `alg`
 * is a header no producer may write on either wire, and answering it with a
 * PLACEMENT complaint would tell the caller to move a parameter it must instead
 * stop naming. It also runs on the WIRE-NAMED bag here, before any label
 * translation, which is what keeps it out of the label/name question entirely —
 * see its own docstring. It is handed the keys of BOTH custom buckets, because
 * those are the parameters this call CARRIES that the registry does not answer
 * for, and a producer's own extension is exactly what `crit` is for (RFC 7515
 * §4.1.11). ⛔ Not the protected keys alone: a name the caller wrote into
 * `custom.unprotected` IS a name it may mark critical, and refusing it here would
 * be this gate answering the placement question — the very inversion the
 * paragraph above rejects, pointed the other way. Rule 1b owns that verdict.
 *
 * ⚠ THE `crit`-IN-`custom.unprotected` REFUSAL RUNS BEFORE
 * {@link buildCustomHeader}, and the order decides which of two true verdicts a
 * caller hears. `crit` is registered, so the custom bag would refuse it as
 * misplaced; RFC 9052 §3.1 refuses it as unprotected. The wire's own constraint
 * is reported ahead of aegis's split policy — the same precedence the rules below
 * follow.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER, so the REGISTERED bag is
 * NORMALISED ONCE at the top and every rule then runs over the normalised bag.
 * That is the rule this file already applied to `undefined` — an absent parameter
 * is neither reserved, nor critical, nor a duplicate, because nothing about it
 * reaches either bucket — widened by {@link normaliseHeaders} to "`undefined`, or
 * empty where the registry says prune". One rule, both wires
 * (`build-jose-header.ts` normalises the same way, before its reserved check).
 *
 * ⛔ THE CUSTOM BAGS ARE NOT NORMALISED, and must not be: `normaliseHeaders`
 * reads the registry's `whenEmpty` cell, and an unregistered parameter has no
 * row. A custom `{"x-hint": ""}` therefore travels as the empty string the caller
 * asked to write, on BOTH wires — `buildCustomHeader` drops only `undefined`, and
 * the JOSE twin merges the same bag it produces.
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
 * state it once here rather than leave separate surprises to be rediscovered one
 * refusal at a time. For a REGISTERED parameter whose `whenEmpty` cell says
 * prune, an empty value now emits nothing and therefore triggers nothing:
 * `cose_reserved_header` and `header_no_cose_label` fall silent, as does
 * `jose_reserved_header` on the twin.
 *
 * ⚠ TWO CODES ARE NOT ON THAT LIST AND MUST NOT BE, because the prune is not what
 * makes them unreachable for a registered parameter — the SHAPE is.
 * `cose_crit_param_unprotected` (rule 1b) and `cose_duplicate_header` (rule 3)
 * both compare against the UNPROTECTED bucket, and the only caller door to that
 * bucket is `custom`, which refuses every registered name outright
 * (`build-custom-header.ts`). So a registered parameter cannot reach either rule
 * whether it is pruned or not.
 *
 * ⚠ WHAT EACH STILL ANSWERS, FOR CUSTOM KEYS, stated exactly rather than as
 * "both still fire": rule 1b answers a `crit` naming a key written into
 * `custom.unprotected` — whether or not the same key is also in
 * `custom.protected`, because it runs first — and rule 3 answers a key written
 * into BOTH buckets with no `crit` naming it. They overlap on the both-buckets
 * shape and 1b wins there, which is right: RFC 9052 §3.1's integrity requirement
 * is a fact about the wire, and carrying one parameter twice is a structural
 * complaint about the same header. Measured through this function: `{apu: ""}`, `{zip: ""}`, `{x5c: []}`
 * and `{ crit: ["oid"] }` beside a pruned `oid` each return two maps with no
 * refusal from any rule here. That is the rule, not a set of exceptions to it — a
 * refusal names a statement the caller made about the token, and a parameter that
 * emits no bytes made none. What survives is where bytes or a REFERENT survive:
 * an UNREGISTERED key in `header` is never pruned, so `{nonsense: ""}` still
 * throws `header_no_cose_label`, and the one `whenEmpty: "refuse"` cell
 * (`x5t#S256`) is answered by the normalisation itself with
 * `header_empty_parameter` rather than reaching any rule below.
 *
 * ⚠ `crit` IS THE ONE PLACE A REFERENT OUTLIVES THE PRUNE, and it is answered by
 * REFUSING rather than by exempting — but NOT HERE. The refusal needs the FINISHED
 * protected bucket, and this function only has the caller's half of it, so it
 * lives at the end of `mergeCoseProtected` ({@link assertCritSatisfied}), the
 * COSE analogue of `buildJoseHeader`'s last line. Rule 1 still owns the case with
 * a REAL value in the wrong bucket, and owns it here, which is why the accurate
 * refusal still comes first.
 */
export const buildCoseHeaders = ({
  reserved,
  header,
  custom,
  cert,
  proprietary,
  format,
  error,
}: {
  reserved: ReadonlyArray<string>;
  /** The caller's REGISTERED wire-named bag; it travels PROTECTED. */
  header: Partial<WireTokenHeader> | undefined;
  /**
   * The caller's UNREGISTERED parameters, per bucket. COSE keys each by its own
   * tstr label (RFC 9052 §1.4 `label = int / tstr`).
   */
  custom: CoseWireTokenEnvelope["custom"];
  /**
   * The cert-binding output of `resolveCertBinding` — the COSE twin of
   * `buildJoseHeader`'s `cert` tier, and the one DOMAIN-named input either wire
   * takes. It crosses to the wire vocabulary here, once, through the registry.
   *
   * ⚠ It is NOT subject to the reserved rule below, and must not be: `x5c` and
   * `x5t#S256` are on `COSE_RESERVED` precisely so a CALLER cannot supply a
   * certificate the signing key never had. This tier IS the kit deriving them
   * from that key, which is what the reservation exists to leave room for.
   */
  cert: CertificateHeaderFields | undefined;
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
  // A parameter that emits nothing is not a parameter — see the docstring. The
  // REGISTERED bag is normalised HERE, once, so every rule below sees the same
  // values the wire will, and neither wire refuses what the other silently drops.
  const headerBag = normaliseHeaders(header ?? {});
  const owned = new Set(reserved);

  // Rule 1a — `crit` itself cannot be unprotected (RFC 9052 §3.1). Asked on the
  // RAW bag, ahead of `buildCustomHeader`'s misplacement refusal — see the
  // docstring on why the wire's constraint outranks the split policy.
  //
  // ⚠ `Object.hasOwn`, never `in`: the bag is CALLER-CONTROLLED and `in` resolves
  // through `Object.prototype`. `in` on a caller-influenced key is a BANNED
  // construct in this package.
  if (custom?.unprotected !== undefined && Object.hasOwn(custom.unprotected, "crit")) {
    throw new error("crit cannot be an unprotected COSE header parameter", {
      code: "cose_crit_unprotected",
      title: "COSE crit Must Be Protected",
      details:
        "RFC 9052 requires critical header parameters to be integrity-protected, so crit itself must live in the protected header, not the unprotected one.",
    });
  }

  // Rule 2a — a registered or kit-owned name in either custom bag. Both bags are
  // validated before any placement question, because "this parameter is in the
  // wrong BAG" is prior to "this parameter is in the wrong BUCKET".
  const customProtected = buildCustomHeader({
    custom: custom?.protected,
    owned,
    bucket: "protected",
    error,
  });
  const customUnprotected = buildCustomHeader({
    custom: custom?.unprotected,
    owned,
    bucket: "unprotected",
    error,
  });

  // The NAME-side crit gate, ahead of the placement rules and on the WIRE-NAMED
  // bag — see the docstring and `assert-crit-eligible.ts`.
  // ⛔ BOTH BUCKETS' KEYS, not just the protected ones. The gate answers "may this
  // name stand in a `crit` AT ALL", and a parameter the caller wrote — in either
  // bucket — may. Handing it the protected keys alone made it answer the
  // PLACEMENT question by refusing the name, so a caller who wrote the parameter
  // into `custom.unprotected` was told to stop naming it in `crit` when the repair
  // is to move it to `custom.protected`. Rule 1b below is what says that, and it
  // only gets to speak because this gate lets the name through.
  assertCritEligible({
    header: headerBag,
    custom: new Set([...Object.keys(customProtected), ...Object.keys(customUnprotected)]),
    format,
    error,
  });

  // Rule 1b — a param `crit` lists cannot be unprotected (RFC 9052 §3.1).
  // Checked on the wire-named bags, BEFORE label translation, which is why it
  // compares JOSE names on both sides: a caller writes `crit: ["x-hint"]` and
  // `custom.unprotected["x-hint"]` in the same vocabulary. `wireHeaderToCoseMap`
  // then translates the registered members to the integer labels their parameters
  // are keyed under, because on the wire a crit member IS a label.
  const crit = headerBag.crit;
  if (isArray(crit)) {
    for (const name of crit) {
      if (isString(name) && Object.hasOwn(customUnprotected, name)) {
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

  // Rule 2b — a kit-derived/computed param cannot be set by the caller in the
  // registered bag (the runtime backstop for untyped paths; the bag TYPE already
  // Omits these, and `buildCustomHeader` answers for the custom bags).
  //
  // ⚠ BY JOSE NAME AND BEFORE THE TRANSLATION — the same shape `buildJoseHeader`
  // uses (`owned.has(jose)`), and both halves are load-bearing. The caller's bag
  // and `reserved` are both JOSE-named, so no spelling has to be agreed; and
  // running first is what keeps a value the kit owns out of a value CODEC, which
  // would answer for it before this rule can. `header: { "x5t#S256": "probe" }`
  // reaching the `COSE_CertHash` encoder fails the mint with a base64 complaint
  // about a value the caller was never allowed to state — pinned in
  // `kit-capabilities.test.ts`'s reserved (COSE) probe, which supplies exactly
  // that value for every reserved parameter.
  for (const jose of Object.keys(headerBag)) {
    if (!owned.has(jose)) continue;

    throw new error(`Header parameter "${jose}" is key-derived and cannot be set`, {
      code: "cose_reserved_header",
      data: { parameter: jose, bucket: "header" },
      title: "COSE Reserved Header Parameter",
      details:
        "This header parameter is derived from the signing/encrypting key or computed by the crypto operation, so the kit always sets it; it cannot be supplied in the header bag.",
    });
  }

  // This re-normalises, idempotently — the entries are built from the same bag
  // the rules were checked on, so nothing can be added or removed between the
  // verdict and the wire.
  const protectedEntries = wireHeaderToCoseMap(headerBag, proprietary);
  const unprotectedEntries = new Map<CoseLabel, unknown>();

  // ⚠ THE CUSTOM ENTRIES DO NOT CROSS `wireHeaderToCoseMap`, and must not: that
  // pass resolves every key through `coseWireKey`, which THROWS
  // `header_no_cose_label` for a name the registry does not answer for — which is
  // every custom key. A custom parameter IS its own tstr label (RFC 9052 §1.4),
  // so the key is the label and the value rides verbatim, with no registry codec
  // to apply.
  //
  // ⛔ This registers nothing. `byCoseName` still resolves only the parameters
  // aegis can WRITE under a text label, so a foreign token cannot deliver a
  // REGISTERED parameter under one (`internal/registry/is-private-use-label.ts`);
  // an unknown tstr label reads back into the unknown bag
  // (`cose-wire-header.ts`), never into the registered vocabulary.
  for (const [key, value] of Object.entries(customProtected)) {
    protectedEntries.set(key, value);
  }
  for (const [key, value] of Object.entries(customUnprotected)) {
    unprotectedEntries.set(key, value);
  }

  // Rule 3 — the same param cannot appear in BOTH buckets. It compares LABELS, so
  // it catches a custom key written into both custom bags as well as anything the
  // registry keyed into both.
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

  // The cert tier, LAST — the ordering `buildJoseHeader` states: kit defaults <
  // caller < kit-derived. It is merged AFTER the rules because those rules are
  // about what a CALLER stated, and this tier is the kit's own derivation.
  //
  // ⚠ The digests cross through `mapTokenHeader`, which is where the DOMAIN names
  // (`certificateThumbprint`, …) become wire ones and the registry's empty-value
  // verdicts apply — an empty `x5t#S256` throws there rather than travelling.
  // `wireHeaderToCoseMap` then shapes each value into its COSE structure:
  // RFC 9360 §2's `COSE_X509` for the chain and `COSE_CertHash` for the digest.
  for (const [label, value] of wireHeaderToCoseMap(
    // The cast is the `iv` column and nothing else: `WireTokenHeaderOptions` types
    // it as the raw `Buffer` a caller hands in, `WireTokenHeader` as the encoded
    // string. A cert tier carries no `iv`.
    mapTokenHeader({}, cert) as Partial<WireTokenHeader>,
    proprietary,
  )) {
    protectedEntries.set(label, value);
  }

  return { protectedEntries, unprotectedEntries };
};
