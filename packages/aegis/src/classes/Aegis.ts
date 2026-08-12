import type { Condition } from "@lindorm/match";
import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import {
  applyKeyFloor,
  DECRYPT_FLOOR,
  type IAmphora,
  mergeConditions,
  SEAL_FLOOR,
  SIGN_FLOOR,
  VERIFY_FLOOR,
} from "@lindorm/amphora";
import { isString } from "@lindorm/is";
import { AegisDomainError } from "../errors/index.js";
import type { IKryptos, KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import type {
  IAegis,
  IAegisAes,
  IAegisCwe,
  IAegisCwm,
  IAegisCws,
  IAegisCwt,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import { dictToBuckets } from "../internal/claims/resolve-domain-buckets.js";
import { domainToJose } from "../internal/claims/translate.js";
import { isCose } from "../internal/cose/is-cose.js";
import {
  isCwe as isCweBytes,
  isCwm as isCwmBytes,
  isCws as isCwsBytes,
  isCwt as isCwtBytes,
} from "../internal/cose/is-cose-format.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import type { OmitMode } from "../internal/utils/apply-omit.js";
import { registerProfile as registerProfileFn } from "../internal/profiles/registry.js";
import type { AegisDeps, ResolveVerifyKeyOptions } from "../internal/utils/aegis-deps.js";
import { decryptToken } from "../internal/utils/decrypt-token.js";
import { encryptToken } from "../internal/utils/encrypt-token.js";
import { createAssertPredicate } from "../internal/utils/create-assert-predicate.js";
import { matches } from "../internal/utils/matches.js";
import { mintToken } from "../internal/utils/mint-token.js";
import { parseToken } from "../internal/utils/parse-token.js";
import { rawDecryptAes } from "../internal/utils/raw-decrypt-aes.js";
import { rawDecryptCwe } from "../internal/utils/raw-decrypt-cwe.js";
import { rawDecryptJwe } from "../internal/utils/raw-decrypt-jwe.js";
import { rawEncryptAes } from "../internal/utils/raw-encrypt-aes.js";
import { rawEncryptCwe } from "../internal/utils/raw-encrypt-cwe.js";
import { rawEncryptJwe } from "../internal/utils/raw-encrypt-jwe.js";
import { rawSignCwm } from "../internal/utils/raw-sign-cwm.js";
import { rawSignCws } from "../internal/utils/raw-sign-cws.js";
import { rawSignCwt } from "../internal/utils/raw-sign-cwt.js";
import { rawSignJws } from "../internal/utils/raw-sign-jws.js";
import { rawSignJwt } from "../internal/utils/raw-sign-jwt.js";
import { rawVerifyCwm } from "../internal/utils/raw-verify-cwm.js";
import { rawVerifyCws } from "../internal/utils/raw-verify-cws.js";
import { rawVerifyCwt } from "../internal/utils/raw-verify-cwt.js";
import { rawVerifyJws } from "../internal/utils/raw-verify-jws.js";
import { rawVerifyJwt } from "../internal/utils/raw-verify-jwt.js";
import { resolveKey } from "../internal/utils/resolve-key.js";
import { signToken } from "../internal/utils/sign-token.js";
import { validate } from "../internal/utils/validate.js";
import { verifyDpopProof } from "../internal/utils/verify-dpop-proof.js";
import { resolveVerifyFloor, verifyToken } from "../internal/utils/verify-token.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisSettings,
  AegisSignKey,
  AegisVerifyKey,
  AesDecryptOptions,
  AesEncryptOptions,
  AssertOptions,
  CertificateBindingMode,
  CweEncryptOptions,
  CwtClaimsWire,
  DecryptedEncryptedToken,
  DecryptedToken,
  DecryptOptions,
  DecryptTokenOptions,
  DomainAssert,
  EncryptData,
  EncryptedToken,
  EncryptOptions,
  JweEncryptOptions,
  JwtClaimsWire,
  NarrowedToken,
  ParsedDpopProof,
  ParsedToken,
  ProfileContentFor,
  ProfileMintOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignedToken,
  SignStructuredTokenOptions,
  SignUnstructuredTokenOptions,
  TokenContent,
  TokenProfile,
  TokenProfileInput,
  VerifiedStructuredToken,
  VerifiedToken,
  VerifiedUnstructuredToken,
  VerifyAssert,
  VerifyDpopProofOptions,
  VerifyOptions,
  VerifyStructuredTokenOptions,
  VerifyUnstructuredTokenOptions,
} from "../types/index.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

const DEFAULT_DPOP_MAX_SKEW = 60;

export class Aegis implements IAegis {
  readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertificateBindingMode;
  private readonly certificateThumbprintSha1: boolean;
  private readonly clockTolerance: number;
  private readonly decryptKey: AegisDecryptKey;
  private readonly deps: AegisDeps;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encryptKey: AegisEncKey;
  private readonly defaultEncryption: KryptosEncryption | undefined;
  private readonly logger: ILogger;
  private readonly partyRecipient: string | undefined;
  private readonly signKey: AegisSignKey;
  private readonly verifyKey: AegisVerifyKey;

  constructor(options: AegisSettings) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    // The service's OWN issuer — amphora's `internal` scope, which is `null` for
    // a verify-only deployment that declares none.
    this.issuer = options.issuer ?? this.amphora.internal?.issuer ?? null;

    // The two issuer strings are configured SEPARATELY, and since read-side key
    // selection is scoped by issuer they now have to agree exactly. Amphora
    // stamps every key we add with ITS issuer; a token we mint carries THIS one.
    // A difference that used to be invisible — a trailing slash, a hostname
    // variant — becomes a hard verify failure on our own tokens, and the error
    // it produces ("no such key under that issuer") does not point at the cause.
    // So say it once, loudly, at construction.
    const amphoraIssuer = this.amphora.internal?.issuer;

    if (options.issuer && amphoraIssuer && options.issuer !== amphoraIssuer) {
      this.logger.warn(
        "Aegis issuer differs from the amphora issuer; verification of self-issued tokens will fail",
        { aegis: options.issuer, amphora: amphoraIssuer },
      );
    }

    this.certBindingMode = options.certBindingMode ?? "strict";
    // Default TRUE: a cert-bound token carries `x5t` for older clients unless the
    // deployment (or a per-call option) opts out. Write-side emission gate only.
    this.certificateThumbprintSha1 = options.certificateThumbprintSha1 ?? true;
    this.clockTolerance = options.clockTolerance ?? 0;
    this.dpopMaxSkew = options.dpopMaxSkew;
    // No floor here: the FLOOR lives in the wire kits, which apply it only
    // after the resolved key has had its say.
    this.defaultEncryption = options.defaultEncryption;
    this.partyRecipient = options.partyRecipient;

    // The DEPLOYMENT's key policy. Aegis ships no default selector of its own:
    // it does not know a deployment's `purpose` taxonomy, and an EMPTY condition
    // is already the safe one. Amphora's default gate is `!internal || publish`
    // — it hides an INTERNAL unpublished key (the KEK / CA / cookie hazard) and
    // leaves every external key selectable, because `publish` means "belongs in
    // OUR JWKS" and an external key never does. Naming `publish` here would be
    // worse than redundant: a condition that mentions it opts OUT of that gate
    // entirely, so `publish: true` would exclude the external keys verification
    // depends on.
    this.signKey = options.sign ?? {};
    this.encryptKey = options.encrypt ?? {};
    this.verifyKey = options.verify ?? {};
    this.decryptKey = options.decrypt ?? {};

    // Every pipeline body — the verb surface AND the raw namespaces — lives in
    // `internal/utils/*`; Aegis assembles the state + JOSE/COSE config they need
    // once and delegates. The kit façades are gone (Phase 11): the utils build
    // the wire kits directly from the resolved key + this config. The key
    // resolvers close over `amphora`, so they stay on the class and reach the
    // utils through this bundle.
    this.deps = {
      issuer: this.issuer,
      certBindingMode: this.certBindingMode,
      certificateThumbprintSha1: this.certificateThumbprintSha1,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew ?? DEFAULT_DPOP_MAX_SKEW,
      defaultEncryption: this.defaultEncryption,
      partyRecipient: this.partyRecipient,
      logger: this.logger,
      resolveSignKey: (options, profile) => this.resolveSignKey(options, profile),
      resolveVerifyKey: (options) => this.resolveVerifyKey(options),
      resolveEncryptKey: (encrypt) => this.resolveEncryptKey(encrypt),
      resolveDecryptKey: (id, algorithm, decrypt) =>
        this.resolveDecryptKey(id, algorithm, decrypt),
      resolveEncKey: (encrypt, required) => this.resolveEncKey(encrypt, required),
    };
  }

  get aes(): IAegisAes {
    return {
      encrypt: this.aesEncrypt.bind(this) as IAegisAes["encrypt"],
      decrypt: this.aesDecrypt.bind(this),
    };
  }

  get cwe(): IAegisCwe {
    return {
      encrypt: this.cweEncrypt.bind(this),
      decrypt: this.cweDecrypt.bind(this),
    };
  }

  get cwm(): IAegisCwm {
    return {
      sign: this.cwmSign.bind(this),
      verify: this.cwmVerify.bind(this),
    };
  }

  get cws(): IAegisCws {
    return {
      sign: this.cwsSign.bind(this),
      verify: this.cwsVerify.bind(this),
    };
  }

  get cwt(): IAegisCwt {
    return {
      sign: this.cwtSign.bind(this),
      verify: this.cwtVerify.bind(this),
    };
  }

  get jwe(): IAegisJwe {
    return {
      encrypt: this.jweEncrypt.bind(this),
      decrypt: this.jweDecrypt.bind(this),
    };
  }

  get jws(): IAegisJws {
    return {
      sign: this.jwsSign.bind(this),
      verify: this.jwsVerify.bind(this),
    };
  }

  get jwt(): IAegisJwt {
    return {
      sign: this.jwtSign.bind(this),
      verify: this.jwtVerify.bind(this),
    };
  }

  registerProfile(profile: TokenProfileInput): void {
    registerProfileFn(profile);
  }

  sign(input: RawSignInput): Promise<SignedToken> {
    return signToken({ input, deps: this.deps });
  }

  // The domain confidentiality surface (§5e), the mirror of `sign`: NO inner
  // signature (sender auth is `mint(profile, content, { encrypt })`, read with
  // `verify`). `encrypt` translates domain claims to the wire then seals them in
  // a JWE/CWE; `decrypt` reverses it with NO signature check.
  encrypt(data: EncryptData, options: EncryptOptions = {}): Promise<EncryptedToken> {
    return encryptToken({ data, options, deps: this.deps });
  }

  decrypt<C extends Dict = Dict>(
    token: string,
    options: DecryptOptions = {},
  ): Promise<DecryptedToken<C>> {
    return decryptToken<C>({ token, options, deps: this.deps });
  }

  // The KEYLESS, UNVERIFIED domain read of ALL seven wire formats. It touches no
  // key: it decodes and domain-translates whatever is readable without one — a
  // structured token's header + claims buckets, an unstructured token's header +
  // opaque payload, an encrypted token's header alone. An INSTANCE verb (uniform
  // with `verify`/`decrypt`), not a static, even though the decode needs no `deps`.
  parse<C extends Dict = Dict>(token: string): ParsedToken<C> {
    return parseToken<C>(token);
  }

  mint<P extends string>(
    profile: P,
    content: ProfileContentFor<P>,
    options?: ProfileMintOptions,
  ): Promise<SignedToken>;
  mint(
    profile: string,
    content: SignContent,
    options: ProfileMintOptions = {},
  ): Promise<SignedToken> {
    return mintToken({ name: profile, content, options, deps: this.deps });
  }

  verify<P extends keyof BuiltInProfiles>(
    profile: P,
    token: string,
    assert: VerifyAssert | undefined,
    options: ProfileVerifyOptions,
  ): Promise<NarrowedToken<BuiltInProfiles[P]>>;
  verify(
    profile: string & {},
    token: string,
    assert: VerifyAssert | undefined,
    options: ProfileVerifyOptions,
  ): Promise<VerifiedToken>;
  verify<C extends Dict = Dict>(
    token: string,
    assert?: VerifyAssert,
    options?: VerifyOptions,
  ): Promise<VerifiedToken<C>>;
  async verify(
    tokenOrProfile: string,
    assertOrToken?: VerifyAssert | string,
    optionsOrAssert?: VerifyAssert | VerifyOptions,
    profileOptions?: ProfileVerifyOptions,
  ): Promise<VerifiedToken> {
    // Profiled overload: the 2nd positional is the token (a string); the 3rd is
    // the optional `assert`, the 4th the profile options. Non-profiled: the 2nd
    // positional is the optional `assert` object, the 3rd the verify options.
    if (isString(assertOrToken)) {
      const options = profileOptions ?? ({} as ProfileVerifyOptions);
      const floor = resolveVerifyFloor(tokenOrProfile, options, this.deps);

      // `audience`/`issuer` are the floor's; `rest` is the pure verify-knob set.
      const { audience: _audience, issuer: _issuer, ...rest } = options;

      return verifyToken({
        token: assertOrToken,
        assert: optionsOrAssert as VerifyAssert | undefined,
        options: {
          ...rest,
          // The profile floor owns the real typ and exp presence policy, so the
          // generic policy pass stands down: a typ-less RFC 7523 client assertion
          // must reach the floor, and a `lifetime: null` profile (an RFC 8417 SET,
          // introspection, userinfo) mints tokens with no exp at all.
          typPresence: "optional",
          expPresence: floor.profile.lifetime === null ? "optional" : "required",
        },
        deps: this.deps,
        floor,
        issuer: floor.expectedIssuer,
      });
    }

    return verifyToken({
      token: tokenOrProfile,
      assert: assertOrToken,
      options: optionsOrAssert as VerifyOptions | undefined,
      deps: this.deps,
    });
  }

  // public static

  static isJwe(jwe: string): boolean {
    return JweKit.isJwe(jwe);
  }

  static isJws(jws: string): boolean {
    return JwsKit.isJws(jws);
  }

  static isJwt(jwt: string): boolean {
    return JwtKit.isJwt(jwt);
  }

  // The JOSE-family umbrella and the counterpart to `isCose`: true for any JOSE
  // token (a JWE, JWS, or JWT), so a caller can gate the two wire families without
  // spelling out the three JOSE forms.
  static isJose(token: string): boolean {
    return Aegis.isJwe(token) || Aegis.isJws(token) || Aegis.isJwt(token);
  }

  /**
   * Verify an RFC 9449 DPoP proof STANDALONE — signature over the embedded `jwk`,
   * `typ: dpop+jwt`, the RFC 7638 thumbprint against the token's bound `cnf.jkt`,
   * the `ath` hash of the presented access token (§7), and `iat` freshness. The
   * same body `aegis.verify` runs for its `dpopProof` option, exposed as a static
   * because it needs no key resolution: the proof carries its own key.
   *
   * A resource server needs this when the access token is NOT locally verifiable.
   * RFC 9449 §6.2 conveys the binding via `cnf.jkt` in the introspection response
   * and has the resource server "validate the access token binding itself
   * locally", so the same proof check must run whether the thumbprint came from a
   * verified JWT or from an introspection response.
   *
   * The request-context claims (`htm`/`htu`) are PARSED, never compared here —
   * aegis does not see the HTTP request. That comparison is the consumer's
   * (pylon does it in middleware).
   */
  static verifyDpopProof(options: VerifyDpopProofOptions): ParsedDpopProof {
    return verifyDpopProof({
      proof: options.proof,
      accessToken: options.accessToken,
      expectedThumbprint: options.expectedThumbprint,
      dpopMaxSkew: options.dpopMaxSkew ?? DEFAULT_DPOP_MAX_SKEW,
    });
  }

  static isCose(token: string): boolean {
    // The cheap gate: a JOSE token is dot-delimited, a COSE token never is — so a
    // dotted token bails before any CBOR work. Otherwise it is base64url CBOR, and
    // the tag decides.
    if (token.includes(".")) return false;

    return isCose(Buffer.from(token, "base64url"));
  }

  // The COSE sub-format detectors, symmetric with isJwt/isJws/isJwe (Bit 8). A
  // COSE token is never dot-delimited, so a dotted token bails cheaply; otherwise
  // the COSE structure tag + typ decide (see `is-cose-format.ts`).
  static isCwt(token: string): boolean {
    if (token.includes(".")) return false;

    return isCwtBytes(Buffer.from(token, "base64url"));
  }

  static isCwm(token: string): boolean {
    if (token.includes(".")) return false;

    return isCwmBytes(Buffer.from(token, "base64url"));
  }

  static isCws(token: string): boolean {
    if (token.includes(".")) return false;

    return isCwsBytes(Buffer.from(token, "base64url"));
  }

  static isCwe(token: string): boolean {
    if (token.includes(".")) return false;

    return isCweBytes(Buffer.from(token, "base64url"));
  }

  // The claim translator, exposed as the public vocabulary source of truth (Bit
  // 8). These ARE the internal translator functions — pylon's relocated
  // userinfo/introspection parsing and tyr build their claim mapping on them
  // without re-deriving the registry. `toWire`: domain-keyed common claims →
  // jose-keyed wire dict; `toDomain`: jose/camel-keyed wire →
  // `{ claims, custom, profile, sensitive }` — the SAME four buckets the token
  // read path resolves, so a consumer never re-derives the split itself.
  static toWire = domainToJose;

  static toDomain = dictToBuckets;

  // `Aegis.decode` is DROPPED (Bit 2) — use `aegis.<fmt>.decode` for a known
  // format, or the INSTANCE `aegis.parse` for an unknown one.

  /**
   * Test a flat claim dict against a {@link DomainAssert} — the boolean form of
   * {@link Aegis.assert}, for a caller that BRANCHES on the answer rather than
   * rejecting the token. Same arguments, same vocabulary, same temporal window.
   *
   * Works on any flat claim source — a parsed domain claim set or any
   * structurally-compatible dict.
   */
  static matches(claims: Dict, assert: DomainAssert, options?: AssertOptions): boolean {
    return matches(claims, createAssertPredicate(assert, options));
  }

  /**
   * `assert` is VERIFY'S CLAIM CHECKING, WITHOUT THE SIGNATURE — the same
   * matcher argument (`DomainAssert`) and the same temporal window
   * ({@link AssertOptions}) `aegis.verify` applies, run over a flat claim dict
   * that arrived some other way (an introspection response, a cached credential).
   * That is why the temporal range is checked here by DEFAULT: a claim set inside
   * verify's skew window must not pass one surface and fail the other.
   *
   * ⚠ The tolerances agree at the DEFAULT only. This is a STATIC method, so it
   * cannot read a deployment's `AegisSettings.clockTolerance` — that is stored
   * `private` on the instance and reaches `verify` alone. Both default to `0`, so
   * they match until a deployment configures a non-zero tolerance, at which point
   * `verify` widens and this does not. A caller with an instance must pass the
   * same value explicitly; there is no way to read it back off `IAegis`.
   *
   * The throwing layer over {@link Aegis.matches}: throws
   * `AegisDomainError("Invalid token")` naming every failing key.
   *
   * ⚠ It used to promise a bare `LindormError`, and that promise was the defect:
   * `AegisError` extends `LindormError`, so the instance failed every
   * `instanceof AegisError` guard a consumer had written around it. Reversing the
   * documented contract is deliberate — `instanceof AegisError` is what this
   * package asks consumers to branch on, and a door that does not honour it is a
   * door they cannot use.
   */
  static assert(claims: Dict, assert: DomainAssert, options?: AssertOptions): void {
    validate(
      claims,
      createAssertPredicate(assert, options),
      AegisDomainError,
      "claims_invalid",
    );
  }

  // private raw namespaces — each a ONE-LINE delegator to its
  // `internal/utils/raw-*` body. The bodies (key-resolve → kit → native wire)
  // moved out in Phase 12; the class keeps only the namespace signatures the
  // `IAegis*` interfaces bind to.

  // private aes
  private aesEncrypt(
    data: AesContent,
    modeOrOptions?: "cbor" | "record" | "serialised" | AesEncryptOptions,
    maybeOptions?: AesEncryptOptions,
  ): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> {
    return rawEncryptAes({ data, modeOrOptions, maybeOptions, deps: this.deps });
  }

  private aesDecrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): Promise<T> {
    return rawDecryptAes<T>({ data, options, deps: this.deps });
  }

  // private jwe
  private jweEncrypt(
    data: TokenContent,
    options: JweEncryptOptions & { key?: AegisEncKey } = {},
  ): Promise<EncryptedToken> {
    return rawEncryptJwe({ data, options, deps: this.deps });
  }

  private jweDecrypt<T extends TokenContent = Buffer>(
    jwe: string,
    options: DecryptTokenOptions & { key?: AegisDecryptKey } = {},
  ): Promise<DecryptedEncryptedToken<T, string>> {
    return rawDecryptJwe<T>({ jwe, options, deps: this.deps });
  }

  // private jws
  private jwsSign(
    data: TokenContent,
    options: SignUnstructuredTokenOptions & { key?: AegisSignKey } = {},
  ): Promise<SignedToken> {
    return rawSignJws({ data, options, deps: this.deps });
  }

  private jwsVerify<T extends TokenContent = Buffer>(
    jws: string,
    options: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey } = {},
  ): Promise<VerifiedUnstructuredToken<T, string>> {
    return rawVerifyJws<T>({ jws, options, deps: this.deps });
  }

  // private jwt
  private jwtSign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options: SignStructuredTokenOptions & { key?: AegisSignKey } = {},
  ): Promise<SignedToken> {
    return rawSignJwt<C>({ claims, options, deps: this.deps });
  }

  // private cwe
  private cweEncrypt(
    data: TokenContent,
    options: CweEncryptOptions & { key?: AegisEncKey } = {},
  ): Promise<EncryptedToken> {
    return rawEncryptCwe({ data, options, deps: this.deps });
  }

  private cweDecrypt<T extends TokenContent = Buffer>(
    token: string,
    options: DecryptTokenOptions & { key?: AegisDecryptKey } = {},
  ): Promise<DecryptedEncryptedToken<T, Buffer>> {
    return rawDecryptCwe<T>({ token, options, deps: this.deps });
  }

  // private cws
  private cwsSign(
    data: TokenContent,
    options: SignUnstructuredTokenOptions & { key?: AegisSignKey; omit?: OmitMode } = {},
  ): Promise<SignedToken> {
    return rawSignCws({ data, options, deps: this.deps });
  }

  private cwsVerify<T extends TokenContent = Buffer>(
    token: string,
    options: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey } = {},
  ): Promise<VerifiedUnstructuredToken<T, Buffer>> {
    return rawVerifyCws<T>({ token, options, deps: this.deps });
  }

  // private cwt
  private cwtSign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options: SignStructuredTokenOptions & { key?: AegisSignKey } = {},
  ): Promise<SignedToken> {
    return rawSignCwt<C>({ claims, options, deps: this.deps });
  }

  private cwtVerify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<CwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions & { key?: AegisVerifyKey } = {},
  ): Promise<VerifiedStructuredToken<CwtClaimsWire & C, Buffer>> {
    return rawVerifyCwt<C>({ token, assert, options, deps: this.deps });
  }

  // private cwm (COSE_Mac0 / symmetric twin of cwt)
  private cwmSign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options: SignStructuredTokenOptions & { key?: AegisSignKey } = {},
  ): Promise<SignedToken> {
    return rawSignCwm<C>({ claims, options, deps: this.deps });
  }

  private cwmVerify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<CwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions & { key?: AegisVerifyKey } = {},
  ): Promise<VerifiedStructuredToken<CwtClaimsWire & C, Buffer>> {
    return rawVerifyCwm<C>({ token, assert, options, deps: this.deps });
  }

  // Resolve the recipient encryption key for both the JOSE (JWE) and COSE
  // (COSE_Encrypt0) paths. A missing key is a hard error only when the caller
  // explicitly asked to encrypt; when forced only by the sensitive fields it is
  // tolerated — encryption is skipped and they are omitted rather than leaked in
  // cleartext (token-claims.md:98).
  private async resolveEncKey(
    encrypt: AegisEncKey | undefined,
    required: boolean,
  ): Promise<IKryptos | undefined> {
    try {
      return await this.resolveEncryptKey(encrypt);
    } catch (error) {
      if (required) {
        throw error;
      }
      return undefined;
    }
  }

  // private jwt verify
  private jwtVerify<C extends Dict = Dict>(
    jwt: string,
    assert?: Condition<JwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions & { key?: AegisVerifyKey } = {},
  ): Promise<VerifiedStructuredToken<JwtClaimsWire & C, string>> {
    return rawVerifyJwt<C>({ jwt, assert, options, deps: this.deps });
  }

  // private kryptos
  //
  // Key selection is ONE mechanism — a condition — doing two strictly separate
  // jobs (only one of which survives key injection):
  //
  //   FLOOR    — policy. Aegis's invariants for the operation, plus the
  //              artifact's own opinion (profile.algClass). Enforced on EVERY
  //              key that reaches the crypto layer, however it got there.
  //   SELECTOR — a vault query. "Which of MY keys": the deployment default
  //              merged with the per-call condition, caller's key winning. It
  //              is meaningless for a key that never came from the vault, so it
  //              is not applied to an injected key or to one named by a token.
  //
  // SECURITY INVARIANT: verification keys are ALWAYS sourced from Amphora (or
  // supplied outright by the trusted caller). The JOSE header parameters `jku`,
  // `jwk`, `x5u`, `x5c`, `x5t` and `x5t#S256` are never trusted as key sources
  // during verification, even when present in the token header. This closes the
  // "header-embedded key" attack class that has hit multiple other JOSE
  // libraries. The only header input the verifier accepts is `kid`, used as a
  // lookup key into Amphora — never as a key itself.

  private resolveSignKey(
    options: { key?: AegisSignKey },
    profile?: TokenProfile,
  ): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: {
        ...SIGN_FLOOR,
        ...(profile?.algClass ? { algClass: profile.algClass } : {}),
      },
      selector: mergeConditions(this.signKey.condition, options.key?.condition),
      kryptos: options.key?.kryptos ?? this.signKey.kryptos,
      logger: this.logger,
      operation: "sign",
      profile: profile?.name,
    });
  }

  // The deployment/per-call verify policy joins the FLOOR rather than the
  // selector: selection here is driven by the token's own `kid`, so the policy
  // has to be a CHECK on the resolved key to bite at all. The one kid-less case
  // is an injected `kryptos` — verify's escape hatch for a signature made by a
  // key that is not a vault resident (an RFC 7523 `client_secret_jwt` assertion
  // MACed with a client secret; see the `AegisVerifyKey` type comment). Absent
  // an injected key a kid-less token is rejected by `resolveKey` — a token must
  // not steer key selection by its own `alg` (RFC 8725 §3.1). The `selector`
  // below is dead for resolution; it stays only to record the `alg` the token
  // declared.
  private resolveVerifyKey(options: ResolveVerifyKeyOptions): Promise<IKryptos> {
    return resolveKey({
      id: options.id,
      // A `kid` is unique only PER ISSUER, so a bare kid lets ANY registered
      // issuer's key answer for a token claiming to come from another. Narrowing
      // to the issuer the token names (or the one the verifier expects) is what
      // stops a peer's colliding kid from verifying a forged `iss`.
      issuer: options.issuer,
      amphora: this.amphora,
      floor: applyKeyFloor(
        VERIFY_FLOOR,
        this.verifyKey.condition,
        options.verify?.condition,
      ),
      selector: { algorithm: options.algorithm },
      kryptos: options.verify?.kryptos ?? this.verifyKey.kryptos,
      logger: this.logger,
      operation: "verify",
    });
  }

  private resolveEncryptKey(encrypt?: AegisEncKey): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: SEAL_FLOOR,
      selector: mergeConditions(this.encryptKey.condition, encrypt?.condition),
      kryptos: encrypt?.kryptos ?? this.encryptKey.kryptos,
      logger: this.logger,
      operation: "encrypt",
    });
  }

  // Like verify, the deployment/per-call decrypt policy joins the FLOOR rather
  // than the selector: selection is driven by the ciphertext's own key id, so
  // the policy has to be a CHECK on the resolved key to bite at all. There is no
  // kid-less vault search: ciphertext with no `kid` is rejected by `resolveKey`
  // UNLESS a key is injected — an injected `kryptos` is the one thing that skips
  // the vault (never the floor), and it is decrypt's escape hatch for ciphertext
  // written to a key that is not a vault resident. The `selector` below is dead
  // for resolution; it stays only to record the `alg` the ciphertext declared.
  private resolveDecryptKey(
    id: string | undefined,
    algorithm: KryptosEncAlgorithm | undefined,
    decrypt?: AegisDecryptKey,
  ): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: applyKeyFloor(DECRYPT_FLOOR, this.decryptKey.condition, decrypt?.condition),
      selector: { algorithm },
      kryptos: decrypt?.kryptos ?? this.decryptKey.kryptos,
      id,
      logger: this.logger,
      operation: "decrypt",
    });
  }
}
