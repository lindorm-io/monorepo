import type { IKryptos, KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type {
  BindCertificateMode,
  DomainProtectedHeader,
  SignedToken,
  TokenFormat,
  TokenFormatTag,
  TokenProfile,
  TokenProfileTyp,
  VerifyOptions,
  WireTokenHeader,
} from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import type { OmitMode } from "../utils/apply-omit.js";
import type { AegisDeps } from "../utils/aegis-deps.js";

/**
 * A claims token read off the wire — the shape BOTH wires reduce to, so
 * everything above this point is one implementation.
 */
export type ClaimsRead = {
  /** The CLAIMS format actually read: `jwt`, `cwt` (COSE_Sign1) or `cwm` (COSE_Mac0). */
  format: TokenFormatTag;
  /**
   * The wire-keyed claim payload EXACTLY as the wire carried it — what
   * `VerifiedToken.wire.payload` reports for pass-through and re-emit.
   *
   * ⚠ JOSE hands back NumericDates (plain integers) and COSE hands back `Date`s,
   * because the COSE claim codec decodes them on the way out of the kit and the
   * JOSE one does not. That difference is visible to a consumer reading
   * `wire.payload`, so it is preserved rather than normalised here.
   */
  wire: Dict;
  /**
   * The same claims with every temporal claim as a `Date` — what the identity
   * matchers run against, so a temporal matcher compares like with like on both
   * wires. Identical to {@link wire} on COSE.
   */
  matcher: Dict;
  /** The INTEGRITY-PROTECTED header — the only bucket a signature or AEAD covers. */
  protectedHeader: WireTokenHeader;
  /** The UNAUTHENTICATED header bucket. `{}` on JOSE, which has no such bucket. */
  unprotectedHeader: Partial<WireTokenHeader>;
};

/** A {@link ClaimsRead} whose signature/MAC has been checked. */
export type ClaimsVerified = ClaimsRead & {
  /**
   * The algorithm the signature was ACTUALLY verified under. Every claims-bearing
   * kit refuses a header `alg` that differs from the resolved key's own, so a lie
   * there costs the signature and this is never a header parameter taken on trust.
   */
  algorithm: KryptosAlgorithm;
};

export type VerifyClaimsInput = {
  token: string;
  deps: AegisDeps;
  options: VerifyOptions;
  /** The issuer the VERIFIER expects, when it declared one — SCOPES the key lookup. */
  issuer: string | undefined;
};

export type VerifyOpaqueInput = {
  token: string;
  deps: AegisDeps;
  options: VerifyOptions;
};

export type OpaqueVerified = {
  format: TokenFormatTag;
  /** The opaque payload exactly as signed — a string on JOSE, bytes on COSE. */
  payload: Buffer | string;
  protectedHeader: WireTokenHeader;
  unprotectedHeader: Partial<WireTokenHeader>;
};

export type SignClaimsInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /** The DOMAIN-keyed common claims; the wire translates them with its own selector. */
  common: Dict;
  /** The bare typ PREFIX; the kit builds the full media type from it. */
  tokenType: string | undefined;
  header: DomainProtectedHeader | undefined;
  omit: OmitMode | undefined;
  proprietary: boolean | undefined;
  bindCertificate: BindCertificateMode | undefined;
  certificateThumbprintSha1: boolean | undefined;
  /** COSE only — which secured structure to emit (`cwt` = Sign1, `cwm` = Mac0). */
  format: TokenFormat;
};

export type MintTypInput = {
  profile: TokenProfile;
  /** The content's own domain `tokenType`, when it carries one. */
  contentTokenType: TokenType | undefined;
  /** The caller's explicit `SignTokenOptions.typ`. */
  signTyp: string | null | undefined;
  format: TokenFormat;
};

export type EncryptOuterInput = {
  kryptos: IKryptos;
  deps: AegisDeps;
  /** The signed inner token, as its own wire's native serialisation. */
  inner: string;
  /** The bare typ PREFIX for the encrypting outer. */
  tokenType: string | undefined;
  proprietary: boolean | undefined;
  /** ECDH-ES Agreement PartyUInfo (RFC 7518 §4.6.1.2). JOSE only; COSE strips it. */
  partyProducer: string | undefined;
  /** ECDH-ES Agreement PartyVInfo (RFC 7518 §4.6.1.3). JOSE only; COSE strips it. */
  partyRecipient: string | undefined;
  certificateThumbprintSha1: boolean | undefined;
};

/**
 * ONE token wire. The domain layer above it — mint, verify, parse, and the
 * profile floor — is a single implementation; everything that genuinely differs
 * between a JOSE compact serialisation and a COSE structure is either a VALUE on
 * this record or one of its five operations.
 *
 * That split is deliberate and was reached independently three times: a Sign1 or
 * Mac0 structure shares nothing real with a compact JWS, so parameterising BELOW
 * the kit would push wire branches into the one layer that is correct. Above it,
 * a branch is a defect waiting to be written twice — which is what happened to
 * every verb this record replaces.
 */
export type TokenWire = {
  /**
   * Which wire spelling claims are keyed by (`jti` vs `cti`). The ONE naming
   * difference between the two wires at the domain layer.
   */
  readonly nameOf: NameSelector;
  /**
   * `typPresence` when the caller states none.
   *
   * JOSE defaults to `"required"` as aegis POLICY, modelled on RFC 8725 §3.11 —
   * which RECOMMENDS explicit typing rather than mandating it. COSE defaults to
   * `"optional"` because RFC 9596 genuinely leaves the `typ` (label 16) optional,
   * so a conformant foreign CWT may carry none. An EXPLICIT value behaves
   * identically on both.
   */
  readonly defaultTypPresence: "required" | "optional";
  /**
   * Whether reading a claims token on this wire REQUIRES an `iss` claim.
   *
   * ⚠ PRESERVED DIVERGENCE, not a design: the JOSE read has always refused a
   * claims token with no `iss` and the COSE read has always accepted one. Making
   * them agree is a policy change with nothing behind it yet, so it is stated
   * here as one flippable value instead of living implicitly in two functions.
   */
  readonly issuerPresence: "required" | "optional";
  /** This wire's ENCRYPTING outer format. */
  readonly encryptedFormat: TokenFormatTag;
  /**
   * The formats this wire admits as an encrypted token's plaintext. JOSE accepts
   * a nested claims token, an opaque JWS, or another JWE; COSE accepts only a
   * secured claims token, because a COSE_Encrypt0 over an opaque CWS has never
   * been readable here and making it so would be a new capability.
   */
  readonly encryptedInner: ReadonlyArray<TokenFormatTag>;
  /**
   * How this wire spells a profile's `typ` policy — what the verify FLOOR expects
   * the token's own type header to be.
   */
  profileTyp(typ: TokenProfileTyp): string | undefined;
  /**
   * The bare typ PREFIX a profiled MINT stamps on this wire.
   *
   * ⚠ PRESERVED DIVERGENCE: the JOSE mint falls back to the caller's explicit
   * `typ` and then to the content's own `tokenType` when the profile mandates
   * none; the COSE mint has only ever consulted the profile. Both derivations are
   * kept exactly as they were — closing that gap is a behaviour change with no
   * probe behind it — but they now sit side by side under one name instead of in
   * two encoders.
   */
  mintTypPrefix(input: MintTypInput): string | undefined;
  /**
   * The FULL type header a caller's `assert.tokenType` expects on this wire.
   *
   * ⚠ Full, not the bare prefix the kits take. A type whose short name is the
   * bare conventional form — `id_token` reduces to `JWT` — has NO prefix, so
   * handing the kits a prefix left the assertion unenforced for exactly that
   * type: the kit gate is `if (options.tokenType !== undefined)`. Comparing the
   * whole media type is what makes the check total.
   */
  assertedTyp(tokenType: string): string | undefined;

  /** Decode a claims token WITHOUT a key and WITHOUT checking its signature. */
  decodeClaims(token: string): ClaimsRead;
  /** Resolve the key by the token's own `kid` and verify integrity. */
  verifyClaims(input: VerifyClaimsInput): Promise<ClaimsVerified>;
  /**
   * Verify an OPAQUE signed token (a JWS / CWS) — no claims layer, so the payload
   * comes back exactly as it was signed.
   */
  verifyOpaque(input: VerifyOpaqueInput): Promise<OpaqueVerified>;
  /** Secure the domain-keyed common claims as this wire's claims token. */
  signClaims(input: SignClaimsInput): SignedToken;
  /** Wrap a signed token in this wire's encrypting outer. */
  encryptOuter(input: EncryptOuterInput): string;
  /**
   * Peel this wire's encrypting outer. Returns the plaintext as a token STRING
   * plus the outer's declared content type, or `undefined` when the plaintext is
   * not a token at all (a reconstructed object, opaque bytes on a wire that
   * cannot re-serialise them).
   */
  decryptOuter(
    token: string,
    deps: AegisDeps,
  ): Promise<{ inner: string | undefined; contentType: string | undefined }>;
};
