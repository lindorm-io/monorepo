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
 * `custom.unprotected`) — into COSE label maps. It returns entries for the kit to
 * merge into its already-derived maps rather than writing them: a COSE_Encrypt0
 * finalises its protected header before the IV exists, so the merge order is the
 * kit's concern.
 *
 * ⚠ A REGISTERED PARAMETER HAS NO CALLER-CHOSEN BUCKET, which is why `header` has
 * no unprotected twin: every registered parameter a caller may set declares
 * `placement: "protected"`, and the `"either"` cells are kit-owned. An
 * UNREGISTERED parameter has no row, so its bucket is the caller's by necessity —
 * `custom` is where that choice lives. (The READ side still consults
 * `is-protected-only.ts` for a foreign token that puts one there anyway.)
 *
 * `reserved` is the kit's own `KitCapabilities.reserved` row, taken from the
 * capability table so a kit's declared capability and its enforcement cannot
 * drift. It is the RUNTIME backstop for the type-level Omit, which an untyped
 * dict walks past.
 *
 * THE RULES:
 *  1. `crit` itself, or any param it lists, in the unprotected bag → throw
 *     (RFC 9052 §3.1);
 *  2. a registered or kit-owned name inside either `custom` bag → throw
 *     ({@link buildCustomHeader}); a reserved param in `header` → throw;
 *  3. the same param in BOTH buckets → throw.
 *
 * ⚠ THE CRIT-ELIGIBILITY GATE RUNS AHEAD OF THE PLACEMENT RULES
 * ({@link assertCritEligible}): "may this name stand in a `crit` at all" is prior
 * to "is it in the right bucket", so a `crit: ["alg"]` beside an unprotected `alg`
 * hears the naming complaint rather than a move-it-elsewhere one. ⛔ It is handed
 * BOTH custom buckets' keys, not the protected ones alone — a name written into
 * `custom.unprotected` IS a name a producer may mark critical (RFC 7515 §4.1.11),
 * and refusing it here would be this gate answering the placement question. Rule
 * 1b owns that verdict.
 *
 * ⚠ THE `crit`-IN-`custom.unprotected` REFUSAL RUNS BEFORE
 * {@link buildCustomHeader}, so the wire's own constraint (RFC 9052 §3.1) is
 * reported ahead of aegis's bag-split policy.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER: the REGISTERED bag is
 * NORMALISED ONCE at the top and every rule runs over the normalised bag, so
 * `cose_reserved_header` and `header_no_cose_label` fall silent for a pruned
 * value. `build-jose-header.ts` normalises the same way — refusing on COSE what
 * JOSE silently drops is a wire asymmetry an attacker chooses the encoding to
 * exploit.
 *
 * ⛔ THE CUSTOM BAGS ARE NOT NORMALISED, and must not be: `normaliseHeaders` reads
 * the registry's `whenEmpty` cell and an unregistered parameter has no row, so a
 * custom `{"x-hint": ""}` travels as the empty string the caller asked to write.
 * An unregistered key in `header` is likewise never pruned, so `{nonsense: ""}`
 * still throws `header_no_cose_label`.
 *
 * ⚠ RULES 1b AND 3 ARE NOT NARROWED BY THE PRUNE, because the SHAPE is what makes
 * them unreachable for a registered parameter: both compare against the
 * UNPROTECTED bucket, whose only caller door is `custom`, which refuses every
 * registered name outright. For CUSTOM keys 1b answers a `crit` naming a key in
 * `custom.unprotected` and rule 3 a key in both buckets; they overlap and 1b wins,
 * which is right — integrity is a fact about the wire.
 *
 * ⚠ `crit` IS THE ONE PLACE A REFERENT OUTLIVES THE PRUNE, and it is answered by
 * REFUSING rather than exempting — but NOT HERE. That refusal needs the FINISHED
 * protected bucket, so it lives at the end of `mergeCoseProtected`
 * ({@link assertCritSatisfied}). Rule 1 still owns a REAL value in the wrong
 * bucket, which is why the accurate refusal comes first.
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
  /** The caller's UNREGISTERED parameters, per bucket, keyed by tstr label
   * (RFC 9052 §1.5). */
  custom: CoseWireTokenEnvelope["custom"];
  /**
   * The cert-binding output of `resolveCertBinding` — the COSE twin of
   * `buildJoseHeader`'s `cert` tier, and the one DOMAIN-named input either wire
   * takes. It crosses to the wire vocabulary here, once, through the registry.
   *
   * ⚠ It is NOT subject to the reserved rule below, and must not be: `x5c` and
   * `x5t#S256` are on `COSE_RESERVED` so a CALLER cannot supply a certificate the
   * signing key never had, and this tier IS the kit deriving them from that key.
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
  // Normalised HERE, once, so every rule below sees the same values the wire will.
  const headerBag = normaliseHeaders(header ?? {});
  const owned = new Set(reserved);

  // Rule 1a — `crit` itself cannot be unprotected (RFC 9052 §3.1), asked on the RAW
  // bag ahead of `buildCustomHeader`'s misplacement refusal.
  //
  // ⚠ `Object.hasOwn`, NEVER `in`: the bag is CALLER-CONTROLLED and `in` resolves
  // through `Object.prototype`. `in` on a caller-influenced key is a BANNED
  // construct in this package.
  if (custom?.unprotected !== undefined && Object.hasOwn(custom.unprotected, "crit")) {
    throw new error("crit cannot be an unprotected COSE header parameter", {
      code: "cose_crit_unprotected",
      title: "COSE crit Must Be Protected",
      details:
        "crit itself must be integrity-protected, so aegis writes it in the protected header and refuses it in the unprotected one. RFC 9052 §3.1.",
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

  // The NAME-side crit gate, ahead of the placement rules and on the WIRE-NAMED bag
  // (`assert-crit-eligible.ts`).
  // ⛔ BOTH BUCKETS' KEYS, not just the protected ones: the gate answers "may this
  // name stand in a `crit` AT ALL", and a parameter the caller wrote in either
  // bucket may. The protected keys alone would make it answer the PLACEMENT
  // question, and rule 1b below only gets to speak because this gate lets the name
  // through.
  assertCritEligible({
    header: headerBag,
    custom: new Set([...Object.keys(customProtected), ...Object.keys(customUnprotected)]),
    format,
    error,
  });

  // Rule 1b — a param `crit` lists cannot be unprotected (RFC 9052 §3.1). Checked
  // on the wire-named bags BEFORE label translation, so both sides compare JOSE
  // names — the vocabulary the caller wrote them in. `wireHeaderToCoseMap` then
  // translates the registered members to their integer labels.
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

  // Rule 2b — a kit-derived param cannot be set by the caller in the registered bag.
  // The runtime backstop for untyped paths; the bag TYPE already Omits these.
  //
  // ⚠ BY JOSE NAME AND BEFORE THE TRANSLATION, and both halves are load-bearing:
  // the caller's bag and `reserved` are both JOSE-named, so no spelling has to be
  // agreed, and running first keeps a value the kit owns out of a value CODEC that
  // would answer for it first. `header: { "x5t#S256": "probe" }` reaching the
  // `COSE_CertHash` encoder fails the mint with a base64 complaint about a value the
  // caller was never allowed to state — pinned by `kit-capabilities.test.ts`.
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

  // Idempotent: the entries are built from the same bag the rules were checked on,
  // so nothing can be added or removed between the verdict and the wire.
  const protectedEntries = wireHeaderToCoseMap(headerBag, proprietary);
  const unprotectedEntries = new Map<CoseLabel, unknown>();

  // ⚠ THE CUSTOM ENTRIES DO NOT CROSS `wireHeaderToCoseMap`, and must not: that pass
  // resolves every key through `coseWireKey`, which THROWS `header_no_cose_label`
  // for every custom key. A custom parameter IS its own tstr label (RFC 9052 §1.5),
  // so the key is the label and the value rides verbatim.
  //
  // ⛔ This registers nothing: `byCoseName` resolves only the parameters aegis can
  // WRITE under a text label, so a foreign token cannot deliver a REGISTERED
  // parameter under one, and an unknown tstr label reads back into the `custom` bag
  // (`cose-wire-header.ts`).
  for (const [key, value] of Object.entries(customProtected)) {
    protectedEntries.set(key, value);
  }
  for (const [key, value] of Object.entries(customUnprotected)) {
    unprotectedEntries.set(key, value);
  }

  // Rule 3 — the same param cannot appear in BOTH buckets. It compares LABELS, so it
  // catches a custom key in both custom bags as well as a registry-keyed one.
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
  // caller < kit-derived. Merged AFTER the rules, which are about what a CALLER
  // stated.
  //
  // ⚠ The digests cross through `mapTokenHeader`, where the DOMAIN names become wire
  // ones and the registry's empty-value verdicts apply — an empty `x5t#S256` throws
  // there rather than travelling. `wireHeaderToCoseMap` then shapes each value into
  // its COSE structure (RFC 9360 §2).
  for (const [label, value] of wireHeaderToCoseMap(
    // The cast is the `iv` column and nothing else — `WireTokenHeaderOptions` types
    // it as a raw `Buffer`, `WireTokenHeader` as the encoded string. A cert tier
    // carries no `iv`.
    mapTokenHeader({}, cert) as Partial<WireTokenHeader>,
    proprietary,
  )) {
    protectedEntries.set(label, value);
  }

  return { protectedEntries, unprotectedEntries };
};
