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
type KitOwnedHeaderParam =
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
 * The caller-settable PROTECTED wire header bag — the JOSE-named partial header
 * ({@link WireTokenHeader}) minus the kit-owned params. For JOSE it is translated
 * to the single protected header; for COSE it is translated to the protected CBOR
 * map (JOSE names → integer labels). `oid` rides here (ruling 3). Supplying a
 * COSE-label-less param on a COSE kit throws at runtime.
 */
export type WireProtectedHeader = Omit<Partial<WireTokenHeader>, KitOwnedHeaderParam>;

/**
 * The caller-settable UNPROTECTED wire header bag (COSE only — JOSE has no
 * unprotected header): like {@link WireProtectedHeader} but ALSO without `crit`,
 * because RFC 9052 §3.1 requires critical params to be integrity-protected.
 */
export type WireUnprotectedHeader = Omit<WireProtectedHeader, "crit">;

/**
 * The shared sign/encrypt WIRE envelope every kit option intersects (was
 * `TokenSignEnvelope`, misfiled in domain-header.ts). Pure wire, kind-agnostic,
 * format-parallel: the protected/unprotected header bags, the `tokenType` PREFIX
 * (the kit computes `application/<tokenType>+<fmt>`, so it is omitted from the
 * bags themselves), the cert-binding knobs, and the COSE interop gate. The DOMAIN
 * tier retypes `tokenType` to the {@link TokenType} enum and translates it to a
 * prefix; JOSE kits ignore `unprotected`/`proprietary`.
 */
export type WireTokenEnvelope = {
  /** Caller-controlled PROTECTED (integrity-protected) wire header params. */
  header?: WireProtectedHeader;
  /**
   * Caller-controlled UNPROTECTED wire header params (COSE only; JOSE kits ignore
   * it). `crit` is Omit'd — critical params must be integrity-protected.
   */
  unprotected?: WireUnprotectedHeader;
  /**
   * The bare TYPE PREFIX. The kit builds the full media type from it (it knows its
   * format): `"at"` → `application/at+jwt` (JOSE) / `application/at+cwt` (COSE). An
   * absent/empty prefix floors to the bare conventional form. Omitted from the
   * header bags (the kit computes `typ`); the DOMAIN tokenType→prefix mapping is
   * Aegis-side.
   */
  tokenType?: string;
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true` (older-client compat). Independent of
   * `bindCertificate`; the read side never verifies SHA-1. (JOSE only.)
   */
  certificateThumbprintSha1?: boolean;
  /**
   * Allow a lindorm-proprietary (private-use) COSE algorithm/encryption label
   * (default `false`, the D5 interop gate) AND emit private-use compact claim
   * labels. COSE only — JOSE kits ignore it.
   */
  proprietary?: boolean;
};
