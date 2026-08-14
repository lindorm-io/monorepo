import type { Dict } from "@lindorm/types";
import type { JoseError } from "../../errors/index.js";
import type {
  CertificateHeaderFields,
  WireProtectedHeader,
  WireTokenHeaderOptions,
} from "../../types/index.js";
import { mapTokenHeader, shapeWireHeader } from "../utils/token-header.js";
import { canonicalWireHeader } from "./canonical-wire-header.js";

/**
 * Assemble the JOSE protected header — the twin of {@link buildCoseHeaders}, and
 * the ONE place any JOSE kit builds one. `JwtKit`, `JwsKit` and `JweKit` all call
 * it; `encodeJoseHeader` remains the encoder that serialises what it returns.
 *
 * It used to be three hand-written object literals, one per kit, which is three
 * chances to write the same precedence differently — and they did: all three wrote
 * `jku` from the key AFTER the caller's bag, so a caller's `jku` was overwritten
 * even when the key carried none, at which point the parameter vanished entirely.
 *
 * ⚠ THE ORDERING RULE, stated once:
 *
 *     kit DEFAULTS  <  CALLER  <  kit-DERIVED
 *
 * and A TIER CONTRIBUTES ONLY THE PARAMETERS IT ACTUALLY HAS. That second half is
 * what closes the defect by construction rather than by patch: each tier is shaped
 * before it is merged, and shaping drops an absent (or wrongly-typed) value, so no
 * tier can ever write an `undefined` over the tier below it. There is no
 * "unless the kit's value happens to be missing" anywhere.
 *
 * The two tiers that could otherwise argue are DISJOINT by construction: the
 * caller's bag is narrowed to the parameters the caller may set before it is
 * merged, so a kit-owned parameter cannot be in it. `reserved` is the kit's own
 * `KitCapabilities.reserved` row — the same column `buildCoseHeaders` refuses on —
 * and taking the set from the capability table rather than a hand-built list is
 * what stops a kit's declared capability and its enforcement drifting apart.
 *
 * ⚠ TWO DIFFERENT RULES, and only one of them drops:
 *
 *  - a RESERVED parameter THROWS `jose_reserved_header`, exactly as the COSE twin
 *    throws `cose_reserved_header`. A caller naming a kit-owned parameter is
 *    asking the header to describe crypto that did not happen — an `enc` on a
 *    signed JWT, an `x5c` no key backs — and the two wires answer that with one
 *    verdict. Dropping it silently was the JOSE half of the same gap the short
 *    `reserved` rows were: the request disappeared and the token looked fine.
 *  - an UNREGISTERED parameter is still DROPPED, unchanged. That is the closed-set
 *    rule (`unregistered: "drop"`), a different statement about a different
 *    problem, and the COSE side refuses it only because a parameter with no label
 *    has nowhere to go.
 */
export const buildJoseHeader = ({
  reserved,
  defaults,
  header,
  derived,
  cert,
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
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof JoseError;
}): WireTokenHeaderOptions => {
  const owned = new Set(reserved);

  const caller: Dict = {};
  for (const [jose, value] of Object.entries(header ?? {})) {
    // An undefined value is an ABSENT parameter — the shaping pass below drops
    // it, so refusing it would refuse a bag that emits nothing. The COSE twin
    // skips it for the same reason (`wireHeaderToCoseMap` never keys it).
    if (value === undefined) continue;

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

  return canonicalWireHeader({
    ...shapeWireHeader(defaults),
    ...shapeWireHeader(caller),
    ...shapeWireHeader(derived),
    ...mapTokenHeader({}, cert),
  }) as WireTokenHeaderOptions;
};
