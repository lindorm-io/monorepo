import type { Dict } from "@lindorm/types";
import type { JoseError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  JoseWireTokenEnvelope,
  TokenFormatTag,
  WireProtectedHeader,
  WireTokenHeaderOptions,
} from "../../types/index.js";
import { mapTokenHeader, shapeWireHeader } from "../utils/token-header.js";
import { assertCritEligible } from "./assert-crit-eligible.js";
import { buildCustomHeader } from "./build-custom-header.js";
import { assertCritSatisfied } from "./assert-crit-satisfied.js";
import { canonicalWireHeader } from "./canonical-wire-header.js";
import { normaliseHeaders } from "./normalise-headers.js";

/**
 * Assemble the JOSE protected header — the twin of {@link buildCoseHeaders}, and
 * the ONE place any JOSE kit builds one. `encodeJoseHeader` serialises what it
 * returns.
 *
 * ⚠ THE ORDERING RULE, stated once for all three JOSE kits:
 *
 *     kit DEFAULTS  <  CALLER  <  kit-DERIVED
 *
 * and A TIER CONTRIBUTES ONLY THE PARAMETERS IT ACTUALLY HAS. The second half is
 * load-bearing: each tier is shaped before it is merged and shaping drops an
 * absent value, so no tier writes an `undefined` over the one below it. Without
 * it a kit-DERIVED parameter the key does not carry — a `jku` on a key with none
 * — would blank the caller's and leave the header entirely.
 *
 * The two tiers that could otherwise argue are DISJOINT by construction: the
 * caller's bag is narrowed to what the caller may set before it is merged.
 * `reserved` is the kit's own `KitCapabilities.reserved` row, the same column
 * `buildCoseHeaders` refuses on.
 *
 * ⚠ TWO DIFFERENT RULES, and only one of them drops:
 *
 *  - a RESERVED parameter THROWS `jose_reserved_header`, as the COSE twin throws
 *    `cose_reserved_header`. A caller naming a kit-owned parameter is asking the
 *    header to describe crypto that did not happen, and both wires answer with one
 *    verdict rather than one of them dropping it silently.
 *  - an UNREGISTERED parameter in `header` is DROPPED by the shaping — the
 *    closed-set rule for THAT bag, which keeps a typo a compile error. An
 *    unregistered parameter has its own door, `custom.header`.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER: the caller's bag is
 * NORMALISED ONCE at the top and the reserved check runs over the normalised bag.
 * One rule, both wires. The `whenEmpty: "refuse"` cell never reaches the checks
 * below — the normalisation THROWS for it.
 *
 * ⚠ `crit` IS CHECKED ON THE MERGED HEADER, LAST, and nowhere else
 * ({@link assertCritSatisfied}). Only the caller's tier can WRITE a `crit`, but
 * the parameter it NAMES may come from any tier, so the question can only be
 * asked once they are one bag — which the compact serialisation's single header
 * is (RFC 7515 §7.1). `shapeWireHeader` and `mapTokenHeader` each normalise their
 * own output, so the merge needs no normalisation call of its own.
 *
 * ⚠ THE CUSTOM ENTRIES DO NOT CROSS `shapeWireHeader`, and must not: that pass
 * drops every key the registry does not answer for, which is every key a custom
 * bag holds. They are merged VERBATIM at the CALLER's tier.
 * {@link canonicalWireHeader} is key-agnostic, so they canonicalise with the rest
 * and the signed bytes stay deterministic.
 *
 * ⚠ THE SHAPING IS WHAT PUTS THE HEADER AND ITS `crit` MEMBERS IN ONE VOCABULARY:
 * every tier crosses `shapeWireHeader` or `mapTokenHeader`, and both run
 * `criticalToWire` over `crit`. A tier that stopped mapping members would refuse a
 * satisfied `crit` written in the domain spelling.
 */
export const buildJoseHeader = ({
  reserved,
  defaults,
  header,
  custom,
  derived,
  cert,
  format,
  error,
}: {
  /** The kit's `KitCapabilities.reserved` row — the params a caller may not set. */
  reserved: ReadonlyArray<string>;
  /**
   * The kit's DEFAULTS: a value the kit supplies and the caller may override —
   * the codec-inferred `cty`, and the key's own `jku`. A default is the one thing
   * a caller CAN outrank, which is what separates this tier from `derived`.
   */
  defaults: WireTokenHeaderOptions;
  /** The caller's own wire-named bag, verbatim from the kit's options. */
  header: WireProtectedHeader | undefined;
  /**
   * The caller's UNREGISTERED parameters, in the one bucket the JOSE envelope
   * names `header` ({@link JoseWireTokenEnvelope}).
   */
  custom: JoseWireTokenEnvelope["custom"];
  /**
   * What only the kit can know: the key's algorithm and id, the `typ` built from
   * the `tokenType` prefix, and (JWE) the content encryption, the gated ECDH-ES
   * party info and the key-management output the AES layer produced.
   */
  derived: WireTokenHeaderOptions;
  /**
   * The cert-binding output of `resolveCertBinding`. The one DOMAIN-named input
   * left, so it crosses to the wire here — once, through the registry — rather
   * than each kit crossing it.
   */
  cert: CertificateHeaderFields | undefined;
  /** The wire format tag, which namespaces the `crit` refusal's code. */
  format: TokenFormatTag;
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof JoseError;
}): WireTokenHeaderOptions => {
  const owned = new Set(reserved);

  // ⛔ `Object.create(null)`, not `{}`: the keys are the CALLER's and the next thing
  // done with this bag is `assertCritEligible` reading `caller.crit` off it, which a
  // plain object answers from `Object.prototype`. `normaliseHeaders` closes the same
  // hole one step earlier; this is a second gate, not a restatement. The merge below
  // spreads into an ordinary object, so nothing downstream sees the null prototype.
  const caller: Dict = Object.create(null);
  for (const [jose, value] of Object.entries(normaliseHeaders(header ?? {}))) {
    if (!owned.has(jose)) {
      caller[jose] = value;
      continue;
    }

    throw new error(`Header parameter "${jose}" is key-derived and cannot be set`, {
      code: "jose_reserved_header",
      data: { parameter: jose },
      title: "JOSE Reserved Header Parameter",
      details:
        "This header parameter is derived from the signing/encrypting key or computed by the crypto operation, so the kit always sets it; it cannot be supplied in the header bag.",
    });
  }

  // The NAME-side crit gate, on the caller's bag and BEFORE the shaping
  // (`assert-crit-eligible.ts`). It runs here rather than beside the satisfaction
  // check because `shapeWireHeader` remaps a member's spelling (`objectId` -> `oid`)
  // — asked after the merge, a domain-spelled member would be translated for the
  // caller on this wire and refused on the other.
  //
  // ⚠ The custom bag is validated BEFORE the crit gate, because the gate reads its
  // keys: a `crit` naming a REGISTERED key written into `custom` must hear about the
  // misplaced parameter rather than about a crit member legal in `header`.
  const customHeader = buildCustomHeader({
    custom: custom?.header,
    owned,
    bucket: "header",
    error,
  });

  assertCritEligible({
    header: caller,
    custom: new Set(Object.keys(customHeader)),
    format,
    error,
  });

  const assembled = canonicalWireHeader({
    ...shapeWireHeader(defaults),
    ...shapeWireHeader(caller),
    ...customHeader,
    ...shapeWireHeader(derived),
    ...mapTokenHeader({}, cert),
  }) as WireTokenHeaderOptions;

  // LAST, on the merged bag: this is the first point the whole message exists, and a
  // `crit` is a statement about the whole message.
  //
  // ⚠ As a Map, built by `Object.entries`. The check looks a caller-controlled
  // `crit` MEMBER up as a key, and a member looked up on a plain object resolves
  // through `Object.prototype` — `crit: ["toString"]` reads as satisfied by a
  // parameter no header carries. `Object.entries` yields own keys only and a Map has
  // no chain to walk, so the hazard is closed structurally.
  assertCritSatisfied({
    bucket: new Map(Object.entries(assembled)),
    critKey: "crit",
    format,
    error,
  });

  return assembled;
};
