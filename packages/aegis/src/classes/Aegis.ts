import {
  type AesContent,
  type AesDecryptionRecord,
  type AesEncryptionRecord,
  AesKit,
  type SerialisedAesDecryption,
  type SerialisedAesEncryption,
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
import { getUnixTime } from "@lindorm/date";
import { isBuffer, isDate, isString } from "@lindorm/is";
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
import { coseTypFromTokenType } from "../internal/cose/cose-typ.js";
import { isCose } from "../internal/cose/is-cose.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import { registerProfile as registerProfileFn } from "../internal/profiles/registry.js";
import type { AegisDeps } from "../internal/utils/aegis-deps.js";
import { assembleCwtClaims } from "../internal/utils/assemble-cwt-claims.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import { mintToken } from "../internal/utils/mint-token.js";
import {
  type IntrospectClaimsInput,
  parseIntrospection,
} from "../internal/utils/parse-introspection.js";
import { parseToken } from "../internal/utils/parse-token.js";
import {
  parseUserinfo,
  type UserinfoClaimsInput,
} from "../internal/utils/parse-userinfo.js";
import { resolveKey } from "../internal/utils/resolve-key.js";
import { signToken } from "../internal/utils/sign-token.js";
import { validateCwtClaims } from "../internal/utils/validate-cwt-claims.js";
import { validate as validateClaims } from "../internal/utils/validate.js";
import { verifyProfileToken } from "../internal/utils/verify-profile-token.js";
import { verifyToken } from "../internal/utils/verify-token.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisIntrospection,
  AegisSettings,
  AegisSignKey,
  AegisUserinfo,
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
  EncryptedCwe,
  EncryptedJwe,
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
import { CoseKit } from "./CoseKit.js";
import { type CwtDecoded, CwtKit } from "./CwtKit.js";
import { JoseKit } from "./JoseKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

export class Aegis implements IAegis {
  readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertificateBindingMode;
  private readonly clockTolerance: number;
  private readonly coseKit: CoseKit;
  private readonly decryptKey: AegisDecryptKey;
  private readonly deps: AegisDeps;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encryptKey: AegisEncKey;
  private readonly encryption: KryptosEncryption;
  private readonly joseKit: JoseKit;
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

    this.coseKit = new CoseKit({
      logger: this.logger,
      clockTolerance: this.clockTolerance,
    });

    // The DEPLOYMENT's key policy. Aegis ships no default selector of its own:
    // it does not know a deployment's `purpose` taxonomy, and amphora already
    // filters `publish: true` by default, so there is nothing to duplicate.
    this.signKey = options.sign ?? {};
    this.encryptKey = options.encrypt ?? {};
    this.verifyKey = options.verify ?? {};
    this.decryptKey = options.decrypt ?? {};

    this.joseKit = new JoseKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew,
      encryption: this.encryption,
      logger: this.logger,
    });

    // The verb-surface pipeline bodies live in `internal/utils/*`; Aegis assembles
    // the state + collaborators they need once and delegates. The key resolvers
    // close over `amphora` (they stay on the class); the kit façades and the
    // raw-namespace operations are threaded through until Phases 11/12 remove them.
    this.deps = {
      issuer: this.issuer,
      clockTolerance: this.clockTolerance,
      encryption: this.encryption,
      joseKit: this.joseKit,
      coseKit: this.coseKit,
      resolveSignKey: (options, profile) => this.resolveSignKey(options, profile),
      resolveVerifyKey: (id, algorithm, verify) =>
        this.resolveVerifyKey(id, algorithm, verify),
      resolveDecryptKey: (id, algorithm, decrypt) =>
        this.resolveDecryptKey(id, algorithm, decrypt),
      resolveEncKey: (encrypt, required) => this.resolveEncKey(encrypt, required),
      verifyJwt: (jwt, verify) => this.jwtVerify(jwt, verify),
      verifyJws: (jws, options) => this.jwsVerify(jws, options),
      decryptJwe: (jwe, options) => this.jweDecrypt(jwe, options),
      signJws: (data, options) => this.jwsSign(data, options),
      signRawCose: (input) => this.signRawCose(input),
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

  static parseUserinfo(data: UserinfoClaimsInput): AegisUserinfo {
    return parseUserinfo(data);
  }

  static parseIntrospection(data: IntrospectClaimsInput): AegisIntrospection {
    return parseIntrospection(data);
  }

  /**
   * Validate a flat claim dict against a JwtClaimMatchers-style declarative
   * matcher. Throws LindormError("Invalid token") with details about every
   * failing key when the claims don't match.
   *
   * Works on any flat claim source — ParsedJwtPayload, AegisIntrospection,
   * AegisUserinfo, or any structurally-compatible dict.
   */
  static validateClaims(claims: Dict, matchers: ValidateJwtOptions): void {
    const predicate = createJwtValidate(matchers);
    validateClaims(claims, predicate);
  }

  // private aes

  // The AES path resolves its key exactly like JWE / COSE do — same resolver,
  // same floor, same deployment-⊕-per-call selector merge. Without the per-call
  // `key` a deployment could only ever hold ONE opinion about encryption, and a
  // pylon's cookie would be sealed with whatever the deployment-wide enc policy
  // picked (in practice the published token key) while the internal `dir` key
  // that exists for the job went unused.
  private async aesEncrypt(
    data: AesContent,
    modeOrOptions?: "cbor" | "record" | "serialised" | AesEncryptOptions,
    maybeOptions?: AesEncryptOptions,
  ): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> {
    // The 2nd arg is EITHER the output mode (a string) OR the options object.
    // When it is a string the 3rd arg carries the options; otherwise the 2nd is
    // the options and the mode defaults to `"cbor"`.
    const mode = isString(modeOrOptions) ? modeOrOptions : "cbor";
    const options = isString(modeOrOptions) ? maybeOptions : modeOrOptions;

    const kryptos = await this.resolveEncryptKey(options?.key);
    const kit = new AesKit({
      encryption: options?.key?.encryption ?? this.encryption,
      kryptos,
    });

    return kit.encrypt(data, mode as "cbor");
  }

  // The ciphertext names its own key, so `findById` — deliberately unfiltered —
  // still decrypts what an expired or since-internalised key sealed. A key the
  // vault never held is the one case that lookup cannot serve, so an injected
  // `kryptos` short-circuits it; the floor still applies, and a supplied key
  // that names a different kid than the ciphertext throws (`resolveKey`).
  private async aesDecrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): Promise<T> {
    const parsed = AesKit.parse(data);

    const kryptos = await this.resolveDecryptKey(
      parsed.keyId,
      parsed.algorithm as KryptosEncAlgorithm | undefined,
      options?.key,
    );
    const kit = new AesKit({ encryption: this.encryption, kryptos });

    return kit.decrypt<T>(data);
  }

  // private jwe

  private async jweEncrypt(
    data: string,
    options: JweEncryptOptions = {},
  ): Promise<EncryptedJwe> {
    const kryptos = await this.resolveEncryptKey(options.key);

    return this.joseKit.encryptJwe(kryptos, data, options, options.key?.encryption);
  }

  private async jweDecrypt(
    jwe: string,
    options: JweDecryptOptions = {},
  ): Promise<DecryptedJwe> {
    const decode = JweKit.decode(jwe);

    const kryptos = await this.resolveDecryptKey(
      decode.header.kid,
      decode.header.alg as KryptosEncAlgorithm,
      options.key,
    );

    return this.joseKit.decryptJwe(kryptos, jwe);
  }

  // private jws

  private async jwsSign<T extends JwsContent>(
    data: T,
    options: SignJwsOptions = {},
  ): Promise<SignedJws> {
    const kryptos = await this.resolveSignKey(options);

    return this.joseKit.signJws(kryptos, data, options);
  }

  private async jwsVerify<T extends JwsContent>(
    jws: string,
    options: VerifyJwsOptions = {},
  ): Promise<ParsedJws<T>> {
    const decode = JwsKit.decode(jws);

    const kryptos = await this.resolveVerifyKey(
      decode.header.kid,
      decode.header.alg as KryptosSigAlgorithm,
      options.key,
    );

    return this.joseKit.verifyJws(kryptos, jws);
  }

  // private jwt

  private async jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options: SignJwtOptions = {},
  ): Promise<SignedJwt> {
    const kryptos = await this.resolveSignKey(options);

    return this.joseKit.signJwt(kryptos, content, options);
  }

  // private cwe — the COSE_Encrypt0 mirror of jwe. Resolves the recipient key
  // exactly as jweEncrypt/jweDecrypt do; COSE_Encrypt0 is direct AEAD, so the key
  // is a symmetric enc key (no key-wrapping).

  private async cweEncrypt(
    data: CweContent,
    options: CweEncryptOptions = {},
  ): Promise<EncryptedCwe> {
    const kryptos = await this.resolveEncryptKey(options.key);

    const inner = isBuffer(data) ? data : Buffer.from(data, "utf8");
    const token = this.coseKit.encrypt(kryptos, inner, {
      typ: options.typ,
      encryption: options.key?.encryption ?? this.encryption,
    });

    return { token: token.toString("base64url") };
  }

  private async cweDecrypt(
    token: string,
    options: CweDecryptOptions = {},
  ): Promise<DecryptedCwe> {
    const bytes = Buffer.from(token, "base64url");

    const kryptos = await this.resolveDecryptKey(
      this.coseKit.decodeEncryptedKid(bytes),
      undefined,
      options.key,
    );

    return { payload: this.coseKit.decrypt(kryptos, bytes), token };
  }

  // private cws — the raw COSE_Sign1 mirror of jws. `cwsSign` reuses the SAME raw
  // COSE signer the `sign({ format: "cws" })` mechanism dispatches to; the
  // namespace is the ergonomic surface over it (as jws coexists with sign).
  // `cwsVerify` mirrors jwsVerify: decode the kid, resolve the verify key, verify.

  private cwsSign(data: CwsContent, options: SignCwsOptions = {}): Promise<SignedCws> {
    return this.signRawCose({
      payload: data,
      key: options.key,
      objectId: options.objectId,
      omit: options.omit,
      tokenType: options.tokenType,
    });
  }

  private async cwsVerify<T extends Dict = Dict>(
    token: string,
    options: VerifyCwsOptions = {},
  ): Promise<ParsedCws<T>> {
    const bytes = Buffer.from(token, "base64url");
    const decoded = this.coseKit.decode(bytes);

    const kryptos = await this.resolveVerifyKey(
      decoded.kid,
      decoded.algorithm as KryptosSigAlgorithm,
      options.key,
    );

    const { claims } = this.coseKit.verify(kryptos, bytes);

    return {
      claims: claims as T,
      header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
      token,
    };
  }

  // private cwt — the generic-CWT mirror of the generic jwt (jwt.sign /
  // joseKit.signJwt). Policy-free: it maps the standard-claim content to the
  // domain-keyed claims (via the shared claim registry) and secures them with
  // coseKit.sign — the SAME primitive mintCose uses, minus the profile floor and
  // auto-injection. Verify mirrors jwtVerify: decode, resolve, verify, then
  // validate the standard claims (exp/nbf/iss/aud) with the JOSE verify matcher.

  private async cwtSign<C extends Dict = Dict>(
    content: SignCwtContent<C>,
    options: SignCwtOptions = {},
  ): Promise<SignedCwt> {
    const kryptos = await this.resolveSignKey({ key: options.key });

    const common = assembleCwtClaims({ issuer: this.issuer }, content, options);

    const token = this.coseKit.sign(kryptos, common, {
      typ: options.typ ?? coseTypFromTokenType(content.tokenType),
      proprietary: options.proprietary,
      omit: options.omit,
    });

    const expiresAt = isDate(common.expiresAt) ? common.expiresAt : undefined;
    const expiresOn = expiresAt ? getUnixTime(expiresAt) : undefined;

    return {
      token: token.toString("base64url"),
      expiresAt,
      expiresIn: expiresOn ? expiresOn - getUnixTime(new Date()) : undefined,
      expiresOn,
      objectId: options.objectId,
      tokenId: isString(common.tokenId) ? common.tokenId : undefined,
    };
  }

  private async cwtVerify<C extends Dict = Dict>(
    token: string,
    verify: VerifyCwtOptions = {},
  ): Promise<ParsedCwt<C>> {
    const bytes = Buffer.from(token, "base64url");
    const decoded = this.coseKit.decode(bytes);

    const kryptos = await this.resolveVerifyKey(
      decoded.kid,
      decoded.algorithm as KryptosSigAlgorithm,
      verify.key,
    );

    const { claims, wire } = this.coseKit.verify(kryptos, bytes);

    validateCwtClaims(wire, kryptos.algorithm, verify, this.clockTolerance);

    return {
      claims: claims as C,
      header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
      token,
    };
  }

  // private sign tiers

  // Raw COSE sign — the profile-less sibling of the `sign` JWS path (the
  // `signToken` util). Secures an arbitrary CBOR claims map as a COSE_Sign1 CWT
  // (the same encoder mintCose uses), typ derived straight from the bare
  // `tokenType`. Shared between the `sign` verb (via `deps.signRawCose`) and the
  // raw `cws.sign` namespace, so it stays on the class. The point is an
  // opaque handle: a base64url CBOR blob a consumer cannot split on dots and
  // read as a JWT. The signing key is resolved exactly as the JWS path does, so
  // a per-call `key` predicate selects it (e.g. an internal, unpublished key).
  private async signRawCose(input: RawSignInput): Promise<SignedJws> {
    // A COSE token secures a CBOR claims MAP; a pre-serialised string/Buffer has
    // no CWT structure to secure. That is valid only for the JOSE path, so it is
    // a caller error here rather than a silent reinterpretation.
    if (isString(input.payload) || isBuffer(input.payload)) {
      throw new AegisError("A COSE payload must be a claims object", {
        code: "cose_payload_not_object",
        title: "COSE Payload Not An Object",
        details:
          "sign({ format: 'cose' }) secures a CBOR claims map, so its payload must be a plain object; a string or Buffer payload is only valid for the default JWS format.",
      });
    }

    const kryptos = await this.resolveSignKey({ key: input.key });

    const token = this.coseKit.sign(kryptos, input.payload, {
      typ: coseTypFromTokenType(input.tokenType),
      omit: input.omit,
    });

    return { objectId: input.objectId, token: token.toString("base64url") };
  }

  // Resolve the recipient encryption key for both the JOSE (JWE) and COSE
  // (COSE_Encrypt0) paths. A missing key is a hard error only when the caller
  // explicitly asked to encrypt; when forced only by `sensitive_identity` it is
  // tolerated — encryption is skipped and the claim is omitted rather than
  // leaked in cleartext (token-claims.md:98).
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

  private async jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify: VerifyJwtOptions = {},
  ): Promise<ParsedJwt<T>> {
    const decode = JwtKit.decode(jwt);

    const kryptos = await this.resolveVerifyKey(
      decode.header.kid,
      decode.header.alg as KryptosSigAlgorithm,
      verify.key,
    );

    return this.joseKit.verifyJwt(kryptos, jwt, verify);
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
