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
  mergePredicates,
  SEAL_FLOOR,
  SIGN_FLOOR,
  VERIFY_FLOOR,
} from "@lindorm/amphora";
import { isString } from "@lindorm/is";
import type {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { AegisError } from "../errors/index.js";
import type {
  IAegis,
  IAegisAes,
  IAegisCwe,
  IAegisCws,
  IAegisCwt,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import { domainToJose, joseToDomain } from "../internal/claims/translate.js";
import { isCose } from "../internal/cose/is-cose.js";
import {
  isCwe as isCweBytes,
  isCws as isCwsBytes,
  isCwt as isCwtBytes,
} from "../internal/cose/is-cose-format.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import { registerProfile as registerProfileFn } from "../internal/profiles/registry.js";
import type { AegisDeps } from "../internal/utils/aegis-deps.js";
import { decryptToken } from "../internal/utils/decrypt-token.js";
import { encryptToken } from "../internal/utils/encrypt-token.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import { mintToken } from "../internal/utils/mint-token.js";
import { parseToken } from "../internal/utils/parse-token.js";
import { rawDecryptAes } from "../internal/utils/raw-decrypt-aes.js";
import { rawDecryptCwe } from "../internal/utils/raw-decrypt-cwe.js";
import { rawDecryptJwe } from "../internal/utils/raw-decrypt-jwe.js";
import { rawEncryptAes } from "../internal/utils/raw-encrypt-aes.js";
import { rawEncryptCwe } from "../internal/utils/raw-encrypt-cwe.js";
import { rawEncryptJwe } from "../internal/utils/raw-encrypt-jwe.js";
import { rawSignCws } from "../internal/utils/raw-sign-cws.js";
import { rawSignCwt } from "../internal/utils/raw-sign-cwt.js";
import { rawSignJws } from "../internal/utils/raw-sign-jws.js";
import { rawSignJwt } from "../internal/utils/raw-sign-jwt.js";
import { rawVerifyCws } from "../internal/utils/raw-verify-cws.js";
import { rawVerifyCwt } from "../internal/utils/raw-verify-cwt.js";
import { rawVerifyJws } from "../internal/utils/raw-verify-jws.js";
import { rawVerifyJwt } from "../internal/utils/raw-verify-jwt.js";
import { resolveKey } from "../internal/utils/resolve-key.js";
import { signToken } from "../internal/utils/sign-token.js";
import { validate as validateClaims } from "../internal/utils/validate.js";
import { verifyProfileToken } from "../internal/utils/verify-profile-token.js";
import { verifyToken } from "../internal/utils/verify-token.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisSettings,
  AegisSignKey,
  AegisVerifyKey,
  AesDecryptOptions,
  AesEncryptOptions,
  CertificateBindingMode,
  CweContent,
  CweDecryptOptions,
  CweEncryptOptions,
  CwsContent,
  DecodedJwe,
  DecodedJws,
  DecodedJwt,
  DecryptedCwe,
  DecryptedJwe,
  DecryptedToken,
  DecryptOptions,
  EncryptData,
  EncryptedCwe,
  EncryptedJwe,
  EncryptedToken,
  EncryptOptions,
  JweDecryptOptions,
  JweEncryptOptions,
  JwsContent,
  NarrowedJwt,
  ParsedCws,
  ParsedCwt,
  ParsedJws,
  ParsedJwt,
  ProfileContent,
  ProfileMintOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignCwsOptions,
  SignCwtContent,
  SignCwtOptions,
  SignedCws,
  SignedCwt,
  SignedJws,
  SignedJwt,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  WireTokenHeader,
  TokenProfile,
  ValidateJwtOptions,
  VerifyCwsOptions,
  VerifyCwtOptions,
  VerifyJwsOptions,
  VerifyJwtOptions,
} from "../types/index.js";
import { type CwtDecoded, CwtKit } from "./CwtKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

const DEFAULT_DPOP_MAX_SKEW = 60;

export class Aegis implements IAegis {
  readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertificateBindingMode;
  private readonly clockTolerance: number;
  private readonly decryptKey: AegisDecryptKey;
  private readonly deps: AegisDeps;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encryptKey: AegisEncKey;
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly signKey: AegisSignKey;
  private readonly verifyKey: AegisVerifyKey;

  constructor(options: AegisSettings) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    this.issuer = options.issuer ?? this.amphora.domain;

    this.certBindingMode = options.certBindingMode ?? "strict";
    this.clockTolerance = options.clockTolerance ?? 0;
    this.dpopMaxSkew = options.dpopMaxSkew;
    this.encryption = options.encryption ?? "A256GCM";

    // The DEPLOYMENT's key policy. Aegis ships no default selector of its own:
    // it does not know a deployment's `purpose` taxonomy, and amphora already
    // filters `publish: true` by default, so there is nothing to duplicate.
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
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew ?? DEFAULT_DPOP_MAX_SKEW,
      encryption: this.encryption,
      logger: this.logger,
      resolveSignKey: (options, profile) => this.resolveSignKey(options, profile),
      resolveVerifyKey: (id, algorithm, verify) =>
        this.resolveVerifyKey(id, algorithm, verify),
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

  registerProfile(profile: TokenProfile): void {
    registerProfileFn(profile);
  }

  sign(input: RawSignInput): Promise<SignedJws> {
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

  mint<P extends keyof ProfileContent>(
    profile: P,
    content: ProfileContent[P],
    options?: ProfileMintOptions,
  ): Promise<SignedJwt>;
  mint(
    profile: string & {},
    content: SignContent,
    options?: ProfileMintOptions,
  ): Promise<SignedJwt>;
  mint(
    profile: string,
    content: SignContent,
    options: ProfileMintOptions = {},
  ): Promise<SignedJwt> {
    return mintToken({ name: profile, content, options, deps: this.deps });
  }

  verify<P extends keyof BuiltInProfiles>(
    profile: P,
    token: string,
    options?: ProfileVerifyOptions,
  ): Promise<NarrowedJwt<BuiltInProfiles[P]>>;
  verify<T extends ParsedJwt>(
    profile: string & {},
    token: string,
    options: ProfileVerifyOptions,
  ): Promise<T>;
  verify(token: string): Promise<ParsedJwt | ParsedJws<any>>;
  verify<T extends ParsedJws<any>>(token: string): Promise<T>;
  verify<T extends ParsedJwt>(token: string, options?: VerifyJwtOptions): Promise<T>;
  async verify<T extends ParsedJwt | ParsedJws<any>>(
    tokenOrProfile: string,
    optionsOrToken?: VerifyJwtOptions | string,
    profileOptions?: ProfileVerifyOptions,
  ): Promise<T> {
    if (isString(optionsOrToken)) {
      return verifyProfileToken<T>({
        name: tokenOrProfile,
        token: optionsOrToken,
        options: profileOptions ?? ({} as ProfileVerifyOptions),
        deps: this.deps,
      });
    }

    return verifyToken<T>({
      token: tokenOrProfile,
      options: optionsOrToken,
      deps: this.deps,
    });
  }

  // public static

  static header(token: string): WireTokenHeader {
    // A COSE token carries its header in the COSE protected map, not a JOSE segment;
    // read the same alg / kid / typ off the CWT.
    if (Aegis.isCose(token)) {
      const { algorithm, kid, typ } = CwtKit.decode(Buffer.from(token, "base64url"));
      return { alg: algorithm as WireTokenHeader["alg"], kid, typ };
    }

    const [header] = token.split(".");
    return decodeJoseHeader(header);
  }

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
  // jose-keyed wire dict; `toDomain`: jose/camel-keyed wire → `{ claims, custom }`.
  static toWire = domainToJose;

  static toDomain = joseToDomain;

  static decode<T extends DecodedJwe | DecodedJws | DecodedJwt | CwtDecoded>(
    token: string,
  ): T {
    if (Aegis.isJwe(token)) {
      return JweKit.decode(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.decode(token) as T;
    }
    if (Aegis.isJwt(token)) {
      return JwtKit.decode(token) as T;
    }
    // A COSE token has no JOSE dot structure — decode it as a CWT. The result is the
    // header metadata (kid / alg / typ); a CWT's claims come from `verify`, since a
    // COSE payload is only meaningful once its integrity is checked.
    if (Aegis.isCose(token)) {
      return CwtKit.decode(Buffer.from(token, "base64url")) as T;
    }
    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token: sanitiseToken(token) },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT, JWE, or JWS, so Aegis cannot select a kit to decode it.",
    });
  }

  static parse<T extends ParsedJwt | ParsedJws<any>>(token: string): T {
    return parseToken<T>(token);
  }

  /**
   * Validate a flat claim dict against a JwtClaimMatchers-style declarative
   * matcher. Throws LindormError("Invalid token") with details about every
   * failing key when the claims don't match.
   *
   * Works on any flat claim source — a ParsedJwtPayload or any
   * structurally-compatible dict.
   */
  static validateClaims(claims: Dict, matchers: ValidateJwtOptions): void {
    const predicate = createJwtValidate(matchers);
    validateClaims(claims, predicate);
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
    data: string,
    options: JweEncryptOptions = {},
  ): Promise<EncryptedJwe> {
    return rawEncryptJwe({ data, options, deps: this.deps });
  }

  private jweDecrypt(
    jwe: string,
    options: JweDecryptOptions = {},
  ): Promise<DecryptedJwe> {
    return rawDecryptJwe({ jwe, options, deps: this.deps });
  }

  // private jws
  private jwsSign<T extends JwsContent>(
    data: T,
    options: SignJwsOptions = {},
  ): Promise<SignedJws> {
    return rawSignJws<T>({ data, options, deps: this.deps });
  }

  private jwsVerify<T extends JwsContent>(
    jws: string,
    options: VerifyJwsOptions = {},
  ): Promise<ParsedJws<T>> {
    return rawVerifyJws<T>({ jws, options, deps: this.deps });
  }

  // private jwt
  private jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options: SignJwtOptions = {},
  ): Promise<SignedJwt> {
    return rawSignJwt<T>({ content, options, deps: this.deps });
  }

  // private cwe
  private cweEncrypt(
    data: CweContent,
    options: CweEncryptOptions = {},
  ): Promise<EncryptedCwe> {
    return rawEncryptCwe({ data, options, deps: this.deps });
  }

  private cweDecrypt(
    token: string,
    options: CweDecryptOptions = {},
  ): Promise<DecryptedCwe> {
    return rawDecryptCwe({ token, options, deps: this.deps });
  }

  // private cws
  private cwsSign(data: CwsContent, options: SignCwsOptions = {}): Promise<SignedCws> {
    return rawSignCws({ data, options, deps: this.deps });
  }

  private cwsVerify<T extends Dict = Dict>(
    token: string,
    options: VerifyCwsOptions = {},
  ): Promise<ParsedCws<T>> {
    return rawVerifyCws<T>({ token, options, deps: this.deps });
  }

  // private cwt
  private cwtSign<C extends Dict = Dict>(
    content: SignCwtContent<C>,
    options: SignCwtOptions = {},
  ): Promise<SignedCwt> {
    return rawSignCwt<C>({ content, options, deps: this.deps });
  }

  private cwtVerify<C extends Dict = Dict>(
    token: string,
    verify: VerifyCwtOptions = {},
  ): Promise<ParsedCwt<C>> {
    return rawVerifyCwt<C>({ token, verify, deps: this.deps });
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
  private jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify: VerifyJwtOptions = {},
  ): Promise<ParsedJwt<T>> {
    return rawVerifyJwt<T>({ jwt, verify, deps: this.deps });
  }

  // private kryptos
  //
  // Key selection is ONE mechanism — a predicate — doing two strictly separate
  // jobs (only one of which survives key injection):
  //
  //   FLOOR    — policy. Aegis's invariants for the operation, plus the
  //              artifact's own opinion (profile.algClass). Enforced on EVERY
  //              key that reaches the crypto layer, however it got there.
  //   SELECTOR — a vault query. "Which of MY keys": the deployment default
  //              merged with the per-call predicate, caller's key winning. It
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
    options: SignJwsOptions | SignJwtOptions,
    profile?: TokenProfile,
  ): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: {
        ...SIGN_FLOOR,
        ...(profile?.algClass ? { algClass: profile.algClass } : {}),
      },
      selector: mergePredicates(this.signKey.predicate, options.key?.predicate),
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
  private resolveVerifyKey(
    id: string | undefined,
    algorithm: KryptosSigAlgorithm | undefined,
    verify?: AegisVerifyKey,
  ): Promise<IKryptos> {
    return resolveKey({
      id,
      amphora: this.amphora,
      floor: applyKeyFloor(VERIFY_FLOOR, this.verifyKey.predicate, verify?.predicate),
      selector: { algorithm },
      kryptos: verify?.kryptos ?? this.verifyKey.kryptos,
      logger: this.logger,
      operation: "verify",
    });
  }

  private resolveEncryptKey(encrypt?: AegisEncKey): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: SEAL_FLOOR,
      selector: mergePredicates(this.encryptKey.predicate, encrypt?.predicate),
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
      floor: applyKeyFloor(DECRYPT_FLOOR, this.decryptKey.predicate, decrypt?.predicate),
      selector: { algorithm },
      kryptos: decrypt?.kryptos ?? this.decryptKey.kryptos,
      id,
      logger: this.logger,
      operation: "decrypt",
    });
  }
}
