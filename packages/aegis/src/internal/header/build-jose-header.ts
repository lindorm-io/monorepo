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
 * the ONE place any JOSE kit builds one. `JwtKit`, `JwsKit` and `JweKit` all call
 * it; `encodeJoseHeader` remains the encoder that serialises what it returns.
 *
 * ⚠ THE ORDERING RULE, stated once, and in ONE place for all three JOSE kits —
 * three literals would be three chances to write the same precedence differently:
 *
 *     kit DEFAULTS  <  CALLER  <  kit-DERIVED
 *
 * and A TIER CONTRIBUTES ONLY THE PARAMETERS IT ACTUALLY HAS. That second half is
 * load-bearing: each tier is shaped before it is merged, and shaping drops an
 * absent (or wrongly-typed) value, so no tier can write an `undefined` over the
 * tier below it. Without it a kit-DERIVED parameter the key does not carry — a
 * `jku` on a key with none — would blank the caller's, and the parameter would
 * leave the header entirely. No merge step is conditioned on a tier's value
 * happening to be present; the shaping is what makes that unnecessary.
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
 *  - an UNREGISTERED parameter in `header` is still DROPPED by the shaping. That
 *    is the closed-set rule for THAT bag, which is what keeps a typo a compile
 *    error there; an unregistered parameter has its own door, `custom.header`,
 *    and the two never meet.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER, so the caller's bag is
 * NORMALISED ONCE at the top and the reserved check then runs over the normalised
 * bag. That is the rule this file already applied to `undefined` — an absent
 * parameter cannot be a reserved one, because nothing about it reaches the wire —
 * widened by {@link normaliseHeaders} to "`undefined`, or empty where the registry
 * says prune". One rule, both wires (`build-cose-headers.ts` normalises the same
 * way, before ALL of its rules), every guard.
 *
 * ⚠ Nothing that emits BYTES stops being guarded: the prune removes only what
 * would have gone on the wire as noise, and a `whenEmpty: "keep"` cell would
 * survive it intact (no header parameter holds one today — see the registry).
 * The one `refuse` cell does not reach the checks below at all; the
 * normalisation THROWS for it, which is the deliberate cost recorded on
 * `x5t#S256`'s registry entry and pinned in this file's tests.
 *
 * ⚠ `crit` IS CHECKED ON THE MERGED HEADER, LAST, and nowhere else
 * ({@link assertCritSatisfied}). A `crit` can only be written by the caller's
 * tier — `defaults` is the inferred `cty` plus the key's `jku`, `derived` is
 * key/crypto output, `cert` is a thumbprint binding — but the parameter it NAMES
 * may come from any of the four, so the question can only be asked once they are
 * one bag. RFC 7515 §7.1 gives the compact serialisation ONE header, and the
 * merged result is it: wire-named and normalised by construction, since
 * `shapeWireHeader` and `mapTokenHeader` each normalise their own output — so
 * the merge needs no normalisation call of its own.
 *
 * ⚠ THE CUSTOM ENTRIES DO NOT CROSS `shapeWireHeader`, and must not: that pass
 * drops every key the registry does not answer for (`token-header.ts`), which is
 * every key a custom bag holds. They are merged VERBATIM, at the CALLER's tier,
 * so a kit-derived parameter still outranks them — the same precedence the
 * caller's registered bag gets. {@link canonicalWireHeader} sorts by key and is
 * key-agnostic, so a custom parameter canonicalises with the rest and the signed
 * bytes stay deterministic.
 *
 * ⚠ The SHAPING is what puts the header and its `crit` MEMBERS in one vocabulary:
 * every tier crosses through `shapeWireHeader` or `mapTokenHeader`, and both run
 * `criticalToWire` over `crit` (`token-header.ts#encodeHeaderValue`). The check
 * therefore compares like with like without mapping anything itself — it holds a
 * bucket whose vocabulary it cannot know, and a JOSE name and a COSE label are
 * different things (RFC 9052 §1.5 admits both forms — `label = int / tstr` — and
 * CBOR keys them apart). That makes the shaping load-bearing rather
 * than cosmetic: a tier that stopped mapping members would refuse a satisfied
 * `crit` written in the domain spelling.
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

  // ⛔ `Object.create(null)`, not `{}`: the keys are the CALLER's, and the very
  // next thing done with this bag is `assertCritEligible` reading `caller.crit`
  // off it. A plain object answers that from `Object.prototype` when the
  // parameter is absent; a `__proto__` assigned here would answer it with the
  // caller's own value. `normaliseHeaders` closes the same hole one step earlier
  // (`prune-empty-headers.ts`), and this is the second gate rather than a
  // restatement of it — the merge below spreads this bag into an ordinary object,
  // so nothing downstream sees the null prototype.
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

  // The NAME-side crit gate, on the caller's bag and BEFORE the shaping — see
  // `assert-crit-eligible.ts`. It has to run here rather than beside the
  // satisfaction check below, because `shapeWireHeader` remaps a member's
  // spelling (`objectId` -> `oid`) and the wire doors take wire names; asked
  // after the merge, a domain-spelled member would already have been translated
  // for the caller on this wire and refused on the other.
  //
  // ⚠ The CALLER's tier is the only one that can carry a `crit`: `defaults` is
  // the inferred `cty` plus the key's `jku`, `derived` is key/crypto output, and
  // `cert` is a thumbprint binding. The parameter a `crit` NAMES may come from
  // any tier — which is why the satisfaction check waits for the merge — but the
  // `crit` itself cannot.
  // The custom bag is validated BEFORE the crit gate, because the gate reads its
  // keys: a `crit` member may name a custom parameter, and one naming a
  // REGISTERED key written into `custom` must hear about the misplaced parameter
  // rather than about a crit member that would have been legal in `header`.
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

  // LAST, on the merged bag — see the docstring. This is the first point the
  // whole message exists, and a `crit` is a statement about the whole message.
  //
  // ⚠ As a Map, and `Object.entries` is what builds it: the check looks a
  // caller-controlled `crit` MEMBER up as a key, and a member looked up on a plain
  // object resolves through `Object.prototype` — `crit: ["toString"]` was
  // "satisfied" by a parameter no header carries. `Object.entries` yields own keys
  // only, and a Map has no chain to walk, so the vocabulary crossing and the
  // hazard are closed in one step rather than by remembering `Object.hasOwn` here.
  assertCritSatisfied({
    bucket: new Map(Object.entries(assembled)),
    critKey: "crit",
    format,
    error,
  });

  return assembled;
};
