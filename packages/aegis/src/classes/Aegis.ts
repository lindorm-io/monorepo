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
import { omitUndefined, sanitiseToken } from "@lindorm/utils";
import { AegisError } from "../errors/index.js";
import type {
  IAegis,
  IAegisAes,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import { coseTyp } from "../internal/cose/cose-typ.js";
import type { BuiltInProfiles } from "../internal/profiles/built-in-profiles.js";
import {
  registerProfile as registerProfileFn,
  resolveProfile,
} from "../internal/profiles/registry.js";
import { assembleCommonClaims } from "../internal/utils/assemble-common-claims.js";
import { buildProfileClaims } from "../internal/utils/build-profile-claims.js";
import { enforceVerifyFloor } from "../internal/utils/enforce-verify-floor.js";
import { extractDomainClaims } from "../internal/utils/extract-claims.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import {
  type IntrospectClaimsInput,
  parseIntrospection,
} from "../internal/utils/parse-introspection.js";
import {
  parseUserinfo,
  type UserinfoClaimsInput,
} from "../internal/utils/parse-userinfo.js";
import { resolveKey } from "../internal/utils/resolve-key.js";
import { selectEncoder } from "../internal/utils/select-encoder.js";
import { validateProfileClaims } from "../internal/utils/validate-profile-claims.js";
import { validate as validateClaims } from "../internal/utils/validate.js";
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
  CertBindingMode,
  DecodedJwe,
  DecodedJws,
  DecodedJwt,
  DecryptedJwe,
  EncryptedJwe,
  JweDecryptOptions,
  JweEncryptOptions,
  JwsContent,
  NarrowedJwt,
  ParsedJws,
  ParsedJwt,
  ProfileContent,
  ProfileMintOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignedJws,
  SignedJwt,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  TokenHeaderClaims,
  TokenProfile,
  ValidateJwtOptions,
  VerifyJwsOptions,
  VerifyJwtOptions,
} from "../types/index.js";
import { CoseKit } from "./CoseKit.js";
import { JoseKit } from "./JoseKit.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

export class Aegis implements IAegis {
  readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertBindingMode;
  private readonly clockTolerance: number;
  private readonly coseKit: CoseKit;
  private readonly decryptKey: AegisDecryptKey;
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
    this.coseKit = new CoseKit({ logger: this.logger });

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

    this.joseKit = new JoseKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew,
      encryption: this.encryption,
      issuer: this.issuer ?? undefined,
      logger: this.logger,
    });
  }

  get aes(): IAegisAes {
    return {
      encrypt: this.aesEncrypt.bind(this) as IAegisAes["encrypt"],
      decrypt: this.aesDecrypt.bind(this),
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
    return this.signRaw(input);
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
    return this.mintProfile(profile, content, options);
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
      return this.verifyProfile<T>(
        tokenOrProfile,
        optionsOrToken,
        profileOptions ?? ({} as ProfileVerifyOptions),
      );
    }

    return this.verifySmart<T>(tokenOrProfile, optionsOrToken);
  }

  private async verifySmart<T extends ParsedJwt | ParsedJws<any>>(
    token: string,
    options?: VerifyJwtOptions,
  ): Promise<T> {
    if (Aegis.isJwt(token)) {
      return (await this.jwtVerify(token, options)) as T;
    }
    if (Aegis.isJwe(token)) {
      const decrypt = await this.jweDecrypt(token);
      return await this.verifySmart(decrypt.payload, options);
    }
    if (Aegis.isJws(token)) {
      return (await this.jwsVerify(token)) as T;
    }

    // A COSE token is base64url CBOR with no JOSE dot structure. Verify its
    // integrity (decrypting a COSE_Encrypt0 if needed) and return the domain
    // claims; like the profile-less JWT path, no profile floor is applied.
    if (!token.includes(".")) {
      const bytes = Buffer.from(token, "base64url");
      if (this.coseKit.isCose(bytes)) {
        const { claims, decoded } = await this.coseVerifyCore(bytes);
        return { claims, header: decoded } as unknown as T;
      }
    }

    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token: sanitiseToken(token) },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT, JWE, JWS, or COSE token, so Aegis cannot select a kit to verify it.",
    });
  }

  // public static

  static header(token: string): TokenHeaderClaims {
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

  static decode<T extends DecodedJwe | DecodedJws | DecodedJwt>(token: string): T {
    if (Aegis.isJwe(token)) {
      return JweKit.decode(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.decode(token) as T;
    }
    if (Aegis.isJwt(token)) {
      return JwtKit.decode(token) as T;
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
    if (Aegis.isJwt(token)) {
      return JwtKit.parse(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.parse(token) as T;
    }
    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token: sanitiseToken(token) },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT or JWS, so Aegis cannot select a kit to parse it.",
    });
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

  // private sign tiers

  private async signRaw(input: RawSignInput): Promise<SignedJws> {
    const payload =
      isString(input.payload) || isBuffer(input.payload)
        ? input.payload
        : JSON.stringify(input.payload);

    return this.jwsSign(payload, {
      bindCertificate: input.bindCertificate,
      contentType: input.contentType,
      header: input.header,
      objectId: input.objectId,
      key: input.key,
      tokenType: input.tokenType,
    });
  }

  private async mintProfile(
    name: string,
    content: SignContent,
    options: ProfileMintOptions,
  ): Promise<SignedJwt> {
    // Encoding seam: dispatch on the per-call format. The COSE path is a
    // separate encoder (P4) that consumes the same domain-keyed common claims;
    // everything above this branch stays encoding-neutral.
    if (selectEncoder(options.format).format === "cose") {
      return this.mintCose(name, content, options);
    }

    const profile = resolveProfile(name);

    // T5 — `options.encrypt` is only meaningful for encryptable profiles.
    // Passing it for a non-encryptable profile (access_token / SET / logout /
    // erasure / DPoP) is a caller error, not a silent no-op.
    if (options.encrypt !== undefined && !profile.encryptable) {
      throw new AegisError("Encryption is not allowed for this profile", {
        code: "encryption_not_allowed",
        data: { profile: profile.name },
        title: "Encryption Not Allowed",
        details:
          "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
      });
    }

    // The profile's algClass is part of the signing FLOOR, so the right class of
    // key is SELECTED here rather than the wrong one being caught afterwards.
    const kryptos = await this.resolveSignKey(options.sign ?? {}, profile);

    // T5 — resolve the recipient (client) enc key when encryption is in play.
    // Encryption fires when the profile is encryptable AND either an explicit
    // `encrypt` option is supplied OR the content carries `sensitive_identity`
    // (forced within id_token). When no enc key is resolvable, encryption is
    // skipped and any `sensitive_identity` is omitted (never emitted in clear).
    const hasSensitiveIdentity = content.sensitiveIdentity != null;
    const explicitEncrypt = options.encrypt !== undefined;
    const wantsEncryption =
      profile.encryptable && (explicitEncrypt || hasSensitiveIdentity);

    // When the caller explicitly asked for encryption, a missing enc key is a
    // hard error. When encryption is forced ONLY by `sensitive_identity`, a
    // missing key is tolerated — the claim is omitted instead (see below).
    const encKryptos = wantsEncryption
      ? await this.resolveEncKey(options.encrypt?.key, explicitEncrypt)
      : undefined;

    // `sensitive_identity` MUST NOT travel in cleartext. If it cannot be
    // encrypted (profile not encryptable, or no enc key resolvable), strip it
    // from the content before signing so the claim is omitted entirely.
    const signContent =
      hasSensitiveIdentity && !encKryptos
        ? (omitUndefined({ ...content, sensitiveIdentity: undefined }) as SignContent)
        : content;

    // Assemble + validate on the DOMAIN-keyed common layer: presence/forbid/
    // conditional policy (inside assembleCommonClaims) + the structural RFC
    // rules (validateProfileClaims). Business logic lives in domain terms.
    const common = assembleCommonClaims(
      { algorithm: kryptos.algorithm, issuer: this.issuer },
      profile,
      signContent,
      { ...(options.sign ?? {}), context: options.context },
    );

    validateProfileClaims(profile, common, {
      ...(options.context ?? {}),
      algorithm: kryptos.algorithm as any,
    });

    // JOSE wire claims: the existing wire mapper, fed the envelope ALREADY
    // resolved on the common layer (iss/iat/jti/nbf/exp) so the signed token
    // matches the validated common layer exactly — one source of truth, and
    // byte-identical to the pre-rebase output.
    const claims = buildProfileClaims(
      { algorithm: kryptos.algorithm, issuer: this.issuer },
      profile,
      {
        ...signContent,
        notBefore: common.notBefore as Date | undefined,
        issuer: common.issuer as string | undefined,
        expires: common.expiresAt as Date | undefined,
      } as SignContent,
      {
        ...(options.sign ?? {}),
        issuedAt: common.issuedAt as Date | undefined,
        tokenId: common.tokenId as string | undefined,
      },
    );

    // A profile typ value stamps the header verbatim (e.g. `at+jwt`) — for
    // BOTH optional and required presence (presence is a verify-side knob
    // only). Presence `none` means "none mandated": fall back to the
    // tokenType-derived default (bare `JWT` when no tokenType), which JwtKit
    // requires as a header floor.
    const signed = this.joseKit.signClaims(
      kryptos,
      claims,
      signContent as SignJwtContent,
      {
        ...(options.sign ?? {}),
        ...(profile.typ.presence !== "none" ? { typ: profile.typ.value } : {}),
      },
    );

    if (!encKryptos) {
      return signed;
    }

    // T5 — sign-then-encrypt. The inner signed JWT keeps the profile typ
    // (`at+jwt` / bare `JWT`); the outer JWE carries `cty: application/jwt`
    // (set automatically by JweKit.encrypt from the inner-token shape). The
    // read side (verifySmart recursion) decrypts then verifies the inner JWT,
    // applying the profile floor to the inner claims/typ.
    const { token } = this.joseKit.encryptJwe(
      encKryptos,
      signed.token,
      {},
      options.encrypt?.key?.encryption,
    );

    return { ...signed, token };
  }

  // The COSE encoder. Consumes the SAME domain-keyed common claims
  // (assembleCommonClaims) and profile validation as the JOSE path; only the
  // wire encoding differs — a secured CWT (COSE_Sign1 / COSE_Mac0), optionally
  // wrapped in a COSE_Encrypt0 (sign-then-encrypt), mirroring the JOSE
  // sign-then-encrypt path. The token bytes are base64url-encoded so the
  // string-token API is preserved.
  private async mintCose(
    name: string,
    content: SignContent,
    options: ProfileMintOptions,
  ): Promise<SignedJwt> {
    const profile = resolveProfile(name);

    // Encryption is only meaningful for encryptable profiles; an encrypt option
    // on a non-encryptable profile is a caller error, not a silent no-op.
    if (options.encrypt !== undefined && !profile.encryptable) {
      throw new AegisError("Encryption is not allowed for this profile", {
        code: "encryption_not_allowed",
        data: { profile: profile.name },
        title: "Encryption Not Allowed",
        details:
          "This token profile is not encryptable, so an encrypt option cannot be supplied; remove it or use an encryptable profile.",
      });
    }

    // Encryption fires when the profile is encryptable AND either an explicit
    // `encrypt` option is supplied OR the content carries `sensitive_identity`.
    // COSE_Encrypt0 is direct AEAD, so the recipient key is a symmetric enc key.
    const hasSensitiveIdentity = content.sensitiveIdentity != null;
    const explicitEncrypt = options.encrypt !== undefined;
    const wantsEncryption =
      profile.encryptable && (explicitEncrypt || hasSensitiveIdentity);

    const encKryptos = wantsEncryption
      ? await this.resolveEncKey(options.encrypt?.key, explicitEncrypt)
      : undefined;

    // `sensitive_identity` MUST NOT travel in cleartext: if it cannot be
    // encrypted, strip it before securing the CWT so it is omitted entirely.
    const signContent =
      hasSensitiveIdentity && !encKryptos
        ? (omitUndefined({ ...content, sensitiveIdentity: undefined }) as SignContent)
        : content;

    const kryptos = await this.resolveSignKey(options.sign ?? {}, profile);

    const common = assembleCommonClaims(
      { algorithm: kryptos.algorithm, issuer: this.issuer },
      profile,
      signContent,
      { ...(options.sign ?? {}), context: options.context },
    );
    validateProfileClaims(profile, common, {
      ...(options.context ?? {}),
      algorithm: kryptos.algorithm as any,
    });

    let token = this.coseKit.sign(kryptos, common, {
      typ: coseTyp(profile.typ),
      proprietary: options.proprietary,
    });

    // Sign-then-encrypt: the inner secured CWT is the COSE_Encrypt0 plaintext.
    if (encKryptos) {
      token = this.coseKit.encrypt(encKryptos, token, {
        typ: coseTyp(profile.typ),
        encryption: options.encrypt?.key?.encryption ?? this.encryption,
      });
    }

    const expiresAt = isDate(common.expiresAt) ? common.expiresAt : undefined;
    const expiresOn = expiresAt ? getUnixTime(expiresAt) : undefined;

    return {
      token: token.toString("base64url"),
      expiresAt,
      expiresIn: expiresOn ? expiresOn - getUnixTime(new Date()) : undefined,
      expiresOn,
      objectId: undefined,
      tokenId: isString(common.tokenId) ? common.tokenId : undefined,
    };
  }

  private async verifyCose<T extends ParsedJwt | ParsedJws<any>>(
    name: string,
    token: string,
    options: ProfileVerifyOptions,
  ): Promise<T> {
    const profile = resolveProfile(name);
    const { claims, decoded, typ } = await this.coseVerifyCore(
      Buffer.from(token, "base64url"),
    );

    const expectedIssuer =
      options.issuer ??
      (profile.issuer === "platform" ? (this.issuer ?? undefined) : undefined);

    enforceVerifyFloor({
      audience: options.audience,
      decodedTyp: typ,
      expectedTyp: coseTyp(profile.typ),
      expectedIssuer,
      payload: claims,
      profile,
    });

    return { claims, header: decoded } as unknown as T;
  }

  // The integrity core shared by the profile (verifyCose) and profile-less
  // (verifySmart) COSE paths: decrypt a COSE_Encrypt0 if present, then resolve
  // the signing/MAC key by kid (kid-only, never a header-embedded key) and
  // verify. The profile floor — if any — is applied by the caller.
  private async coseVerifyCore(input: Buffer) {
    let bytes = input;

    if (this.coseKit.isEncrypted(bytes)) {
      const encKryptos = await this.resolveDecryptKey(
        this.coseKit.decodeEncryptedKid(bytes),
        undefined,
      );
      bytes = this.coseKit.decrypt(encKryptos, bytes);
    }

    const decoded = this.coseKit.decode(bytes);
    const kryptos = await this.resolveVerifyKey(decoded.kid, undefined);
    const { claims, typ } = this.coseKit.verify(kryptos, bytes);

    return { claims, decoded, typ };
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

  private async verifyProfile<T extends ParsedJwt | ParsedJws<any>>(
    name: string,
    token: string,
    options: ProfileVerifyOptions,
  ): Promise<T> {
    // Encoding seam: dispatch on the per-call format (P4 fills the COSE arm).
    if (selectEncoder(options.format).format === "cose") {
      return this.verifyCose<T>(name, token, options);
    }

    const profile = resolveProfile(name);

    // The typ is enforced by enforceVerifyFloor against profile.typ, so we do
    // NOT also pass tokenType to the standard verify (which would compute its
    // own typ expectation and could disagree).
    const {
      audience: _audience,
      issuer: _issuer,
      clockTolerance: _ct,
      format: _format,
      ...rest
    } = options;

    // A `lifetime: null` profile (RFC 8417 / SSF `security_event`, introspection,
    // userinfo) mints tokens with NO exp, so its verify must tolerate an absent
    // exp — the floor below owns the real presence policy. Finite-lifetime
    // profiles stay `"required"` (belt-and-suspenders with the floor's exp check).
    const expPresence = profile.lifetime === null ? "optional" : "required";

    // The typ-sniffing dispatcher (verifySmart) cannot classify a typ-less
    // JWS, but profiled verify knows the format from the profile — so only a
    // JWE goes through verifySmart (decrypt + re-verify the inner JWT); bare
    // tokens verify as JWTs directly, with `typPresence: "optional"` so a
    // typ-less RFC 7523 client assertion reaches the floor, which owns the
    // profile's typ presence policy (required-presence profiles still reject
    // an absent typ there). Direct jwt.verify callers keep the strict default.
    const parsed = Aegis.isJwe(token)
      ? await this.verifySmart<ParsedJwt>(token, { ...rest, expPresence })
      : await this.jwtVerify(token, { ...rest, typPresence: "optional", expPresence });

    const expectedIssuer =
      options.issuer ??
      (profile.issuer === "platform" ? (this.issuer ?? undefined) : undefined);

    // DOMAIN-keyed floor payload from the RAW wire claims, not parsed.payload:
    // parseTokenPayload defaults absent set-valued claims to [] and nests
    // custom claims under `claims`, which would defeat the floor's
    // required-claims presence check. extractDomainClaims reports true wire
    // presence and leaves non-domain claims flat in `rest`.
    const { claims: domain, rest: custom } = extractDomainClaims(
      parsed.decoded.payload as Dict,
    );

    enforceVerifyFloor({
      audience: options.audience,
      decodedTyp: parsed.decoded.header.typ,
      expectedIssuer,
      payload: { ...custom, ...domain },
      profile,
    });

    return parsed as T;
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
  // has to be a CHECK on the resolved key to bite at all. There is no kid-less
  // case: a token with no `kid` is rejected by `resolveKey` (a token must not be
  // able to steer key selection by its own `alg` — RFC 8725 §3.1), and verify
  // has no injectable-key escape hatch by design — that is deferred to the
  // future `client_secret_jwt` slice (see the `AegisVerifyKey` type comment).
  // The `selector` below is therefore dead for resolution; it stays only to
  // record the `alg` the token declared.
  private resolveVerifyKey(
    id: string | undefined,
    algorithm: KryptosSigAlgorithm | undefined,
    verify?: AegisVerifyKey,
  ): Promise<IKryptos> {
    return resolveKey({
      amphora: this.amphora,
      floor: applyKeyFloor(VERIFY_FLOOR, this.verifyKey.predicate, verify?.predicate),
      selector: { algorithm },
      id,
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
