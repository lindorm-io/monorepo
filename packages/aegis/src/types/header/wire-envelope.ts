import type { BindCertificateMode } from "./domain-header.js";
import type { WireTokenHeader } from "./wire-header.js";

/**
 * Wire header params a caller may NEVER set on a kit — the kit derives them from
 * the signing/encrypting kryptos (`alg`/`kid`/`enc`/`x5c`/`x5t`/`x5t#S256`),
 * computes them from the crypto operation (`iv`/`tag`/`epk`/`p2s`/`p2c`), stamps
 * `typ` from the `tokenType` prefix, or reserves the ECDH-ES `apu`/`apv` to the
 * dedicated `partyProducer`/`partyRecipient` options (JWE). Removing them at the
 * TYPE level is the compile-time half of the reserved-param guard.
 */
export type KitOwnedHeaderParam =
  | "alg"
  | "apu"
  | "apv"
  | "enc"
  | "epk"
  | "iv"
  | "kid"
  | "p2c"
  | "p2s"
  | "tag"
  | "typ"
  | "x5c"
  | "x5t"
  | "x5t#S256";

/**
 * The caller-settable REGISTERED wire header bag — the JOSE-named partial header
 * ({@link WireTokenHeader}) minus the kit-owned params. For JOSE it is translated
 * to the single protected header; for COSE it is translated to the protected CBOR
 * map (JOSE names → integer labels). `oid` rides here. Supplying a
 * COSE-label-less param on a COSE kit throws at runtime.
 *
 * ⚠ It is CLOSED, and that is what keeps a typo a compile error: `x5t#s256` is
 * not a member, so it fails the build rather than riding the wire as an
 * unregistered parameter. An unregistered parameter is expressible — under its
 * own option key, `custom` ({@link JoseWireTokenEnvelope} /
 * {@link CoseWireTokenEnvelope}) — so widening this bag buys nothing and costs
 * the typo check.
 *
 * PLACEMENT is the registry's, never the caller's: every param here whose
 * `placement` cell reads `"protected"` travels protected on COSE, and the two
 * cells reading `"either"` (`iv`, `kid`) are kit-owned, so nothing in this bag
 * has a bucket left for a caller to choose (`internal/header/header-registry.ts`,
 * `internal/header/is-protected-only.ts`).
 */
export type WireProtectedHeader = Omit<Partial<WireTokenHeader>, KitOwnedHeaderParam>;

/**
 * The shared sign/encrypt WIRE envelope both wire families intersect: the
 * REGISTERED header bag, the `tokenType` PREFIX (the kit computes
 * `application/<tokenType>+<fmt>`, so it is omitted from the bag itself) and the
 * cert-binding knob. The DOMAIN tier retypes `tokenType` to the {@link TokenType}
 * enum and translates it to a prefix.
 *
 * The per-wire members live on {@link JoseWireTokenEnvelope} and
 * {@link CoseWireTokenEnvelope}; a JOSE kit therefore cannot be handed a COSE-only
 * option at all, which is a compile error rather than an option a kit accepts and
 * ignores.
 */
export type WireTokenEnvelope = {
  /** Caller-controlled REGISTERED (integrity-protected) wire header params. */
  header?: WireProtectedHeader;
  /**
   * The bare TYPE PREFIX. The kit builds the full media type from it (it knows its
   * format): `"at"` → `application/at+jwt` (JOSE) / `application/at+cwt` (COSE). An
   * absent/empty prefix floors to the bare conventional form. Omitted from the
   * header bag (the kit computes `typ`); the DOMAIN tokenType→prefix mapping is
   * Aegis-side.
   */
  tokenType?: string;
  bindCertificate?: BindCertificateMode;
};

/**
 * The JOSE sign/encrypt envelope — {@link WireTokenEnvelope} plus the custom bag.
 *
 * Compact JWS/JWE serialisation carries ONE header and it is integrity-protected
 * (`KIT_CAPABILITIES.<jose kit>.unprotectedBucket: false`), so the custom bucket
 * is named `header` for that one header — `protected` would name a bucket-vs-bucket
 * contrast this wire has no second bucket for — and there is no `custom.unprotected`
 * to write. The COSE spelling is a compile error here (pinned: `wire-envelope.test.ts`).
 */
export type JoseWireTokenEnvelope = WireTokenEnvelope & {
  /**
   * UNREGISTERED header params, carried VERBATIM under their own keys. `custom.header`
   * and the top-level `header` are the UNREGISTERED and REGISTERED halves of that one
   * header; `internal/header/build-jose-header.ts` merges them into one bag.
   *
   * A key the header registry answers for is REFUSED here
   * (`header_registered_in_custom`) — it belongs in `header`, where its codec and
   * placement apply — and a kit-owned param is refused with
   * `header_kit_owned_in_custom`.
   */
  custom?: {
    header?: Record<string, unknown>;
  };
};

/**
 * The COSE sign/encrypt envelope — {@link WireTokenEnvelope} plus the custom bags
 * and the interop gate.
 */
export type CoseWireTokenEnvelope = WireTokenEnvelope & {
  /**
   * UNREGISTERED header params, carried VERBATIM under their own tstr label
   * (RFC 9052 §1.4 `label = int / tstr`). Refused for a registered or kit-owned
   * name exactly as on {@link JoseWireTokenEnvelope}.
   *
   * PLACEMENT is the caller's here, and only here: an unregistered param has no
   * registry row, so no `placement` cell can decide its bucket. A param named in
   * `crit` must sit in `protected` — RFC 9052 §3.1 requires critical params to be
   * integrity-protected, and `unprotected` is covered by nothing.
   */
  custom?: {
    protected?: Record<string, unknown>;
    unprotected?: Record<string, unknown>;
  };
  /**
   * Allow a lindorm-proprietary (private-use) COSE algorithm/encryption label
   * (default `false`, the interop gate) AND emit private-use compact claim
   * labels. COSE only.
   */
  proprietary?: boolean;
};
