import {
  type AesContent,
  type AesDecryptionRecord,
  type AesEncryptionRecord,
  AesKit,
  type SerialisedAesDecryption,
  type SerialisedAesEncryption,
} from "@lindorm/aes";
import type { AmphoraPredicate, IAmphora } from "@lindorm/amphora";
import { getUnixTime } from "@lindorm/date";
import { isBuffer, isDate, isString } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import type {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../errors/index.js";
import type {
  IAegis,
  IAegisAes,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import type {
  AegisIntrospection,
  AegisOptions,
  AegisPredicate,
  AegisUserinfo,
  CertBindingMode,
  DecodedJwe,
  DecodedJws,
  DecodedJwt,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedJws,
  ParsedJwt,
  ProfileContent,
  ProfileSignOptions,
  ProfileVerifyOptions,
  RawSignInput,
  SignContent,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  TokenHeaderClaims,
  TokenProfile,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../types/index.js";
import { CwtKit } from "./CwtKit.js";
import { assembleCommonClaims } from "../internal/utils/assemble-common-claims.js";
import { buildProfileClaims } from "../internal/utils/build-profile-claims.js";
import { selectEncoder } from "../internal/utils/select-encoder.js";
import { validateProfileClaims } from "../internal/utils/validate-profile-claims.js";
import { enforceVerifyFloor } from "../internal/utils/enforce-verify-floor.js";
import {
  registerProfile as registerProfileFn,
  resolveProfile,
} from "../internal/profiles/registry.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import { validate as validateClaims } from "../internal/utils/validate.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  type IntrospectClaimsInput,
  parseIntrospection,
} from "../internal/utils/parse-introspection.js";
import {
  parseUserinfo,
  type UserinfoClaimsInput,
} from "../internal/utils/parse-userinfo.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

type PredicateOptions = {
  predicate?: AegisPredicate;
};

type EncOptions = PredicateOptions & {
  id?: string;
  algorithm?: KryptosEncAlgorithm;
  encrypt?: boolean;
};

type SigOptions = PredicateOptions & {
  id?: string;
  algorithm?: KryptosSigAlgorithm;
  sign?: boolean;
};

export class Aegis implements IAegis {
  public readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertBindingMode;
  private readonly clockTolerance: number;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encAlgorithm: KryptosEncAlgorithm | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly sigAlgorithm: KryptosSigAlgorithm | undefined;

  public constructor(options: AegisOptions) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    this.issuer = options.issuer ?? this.amphora.domain;

    this.certBindingMode = options.certBindingMode ?? "strict";
    this.clockTolerance = options.clockTolerance ?? 0;
    this.dpopMaxSkew = options.dpopMaxSkew;
    this.encAlgorithm = options.encAlgorithm;
    this.encryption = options.encryption ?? "A256GCM";
    this.sigAlgorithm = options.sigAlgorithm;
  }

  public get aes(): IAegisAes {
    return {
      encrypt: this.aesEncrypt.bind(this) as IAegisAes["encrypt"],
      decrypt: this.aesDecrypt.bind(this),
    };
  }

  public get jwe(): IAegisJwe {
    return {
      encrypt: this.jweEncrypt.bind(this),
      decrypt: this.jweDecrypt.bind(this),
    };
  }

  public get jws(): IAegisJws {
    return {
      sign: this.jwsSign.bind(this),
      verify: this.jwsVerify.bind(this),
    };
  }

  public get jwt(): IAegisJwt {
    return {
      sign: this.jwtSign.bind(this),
      verify: this.jwtVerify.bind(this),
    };
  }

  public registerProfile(profile: TokenProfile): void {
    registerProfileFn(profile);
  }

  public sign(input: RawSignInput): Promise<SignedJws> {
    return this.signRaw(input);
  }

  public mint<P extends keyof ProfileContent>(
    profile: P,
    content: ProfileContent[P],
    options?: ProfileSignOptions,
  ): Promise<SignedJwt>;
  public mint(
    profile: string & {},
    content: SignContent,
    options?: ProfileSignOptions,
  ): Promise<SignedJwt>;
  public mint(
    profile: string,
    content: SignContent,
    options: ProfileSignOptions = {},
  ): Promise<SignedJwt> {
    return this.mintProfile(profile, content, options);
  }

  public verify(token: string): Promise<ParsedJwt | ParsedJws<any>>;
  public verify<T extends ParsedJws<any>>(token: string): Promise<T>;
  public verify<T extends ParsedJwt>(
    token: string,
    options?: VerifyJwtOptions,
  ): Promise<T>;
  public verify<T extends ParsedJwt>(
    profile: string,
    token: string,
    options: ProfileVerifyOptions,
  ): Promise<T>;
  public async verify<T extends ParsedJwt | ParsedJws<any>>(
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
    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT, JWE, or JWS, so Aegis cannot select a kit to verify it.",
    });
  }

  // public static

  public static header(token: string): TokenHeaderClaims {
    const [header] = token.split(".");
    return decodeJoseHeader(header);
  }

  public static isJwe(jwe: string): boolean {
    return JweKit.isJwe(jwe);
  }

  public static isJws(jws: string): boolean {
    return JwsKit.isJws(jws);
  }

  public static isJwt(jwt: string): boolean {
    return JwtKit.isJwt(jwt);
  }

  public static decode<T extends DecodedJwe | DecodedJws | DecodedJwt>(token: string): T {
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
      debug: { token },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT, JWE, or JWS, so Aegis cannot select a kit to decode it.",
    });
  }

  public static parse<T extends ParsedJwt | ParsedJws<any>>(token: string): T {
    if (Aegis.isJwt(token)) {
      return JwtKit.parse(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.parse(token) as T;
    }
    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JWT or JWS, so Aegis cannot select a kit to parse it.",
    });
  }

  public static parseUserinfo(data: UserinfoClaimsInput): AegisUserinfo {
    return parseUserinfo(data);
  }

  public static parseIntrospection(data: IntrospectClaimsInput): AegisIntrospection {
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
  public static validateClaims(claims: Dict, matchers: ValidateJwtOptions): void {
    const predicate = createJwtValidate(matchers);
    validateClaims(claims, predicate);
  }

  // private aes

  private async aesKit(options: EncOptions = {}): Promise<AesKit> {
    const kryptos = await this.kryptosEnc(options);

    return new AesKit({ encryption: this.encryption, kryptos });
  }

  private async aesEncrypt(
    data: AesContent,
    mode: "encoded" | "record" | "serialised" | "tokenised" = "encoded",
  ): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> {
    const kit = await this.aesKit({ encrypt: true });

    return kit.encrypt(data, mode as "encoded");
  }

  private async aesDecrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): Promise<T> {
    const parsed = AesKit.parse(data);

    const kit = await this.aesKit({
      id: parsed.keyId,
      algorithm: parsed.algorithm as KryptosEncAlgorithm | undefined,
    });

    return kit.decrypt<T>(data);
  }

  // private jwe

  private async jweKit(options: EncOptions = {}): Promise<JweKit> {
    const kryptos = await this.kryptosEnc(options);

    return new JweKit({
      certBindingMode: this.certBindingMode,
      encryption: this.encryption,
      kryptos,
      logger: this.logger,
    });
  }

  private async jweEncrypt(
    data: string,
    options: JweEncryptOptions & PredicateOptions = {},
  ): Promise<EncryptedJwe> {
    const kit = await this.jweKit({ encrypt: true });

    return kit.encrypt(data, options);
  }

  private async jweDecrypt(jwe: string): Promise<DecryptedJwe> {
    const decode = JweKit.decode(jwe);

    const kit = await this.jweKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosEncAlgorithm,
    });

    return kit.decrypt(jwe);
  }

  // private jws

  private async jwsKit(options: SigOptions = {}): Promise<JwsKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwsKit({
      certBindingMode: this.certBindingMode,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwsSign<T extends JwsContent>(
    data: T,
    options: SignJwsOptions & PredicateOptions = {},
  ): Promise<SignedJws> {
    const kit = await this.jwsKit({ sign: true });

    return kit.sign(data, options);
  }

  private async jwsVerify<T extends JwsContent>(jws: string): Promise<ParsedJws<T>> {
    const decode = JwsKit.decode(jws);

    const kit = await this.jwsKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosSigAlgorithm,
    });

    return kit.verify(jws);
  }

  // private jwt

  private async jwtKit(options: SigOptions = {}): Promise<JwtKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwtKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew,
      issuer: this.issuer ?? undefined,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options: SignJwtOptions & PredicateOptions = {},
  ): Promise<SignedJwt> {
    const kit = await this.jwtKit({ sign: true });

    return kit.sign(content, options);
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
      tokenType: input.tokenType,
    });
  }

  private async mintProfile(
    name: string,
    content: SignContent,
    options: ProfileSignOptions,
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

    const kit = await this.jwtKit({ sign: true });

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
    const jweKit = wantsEncryption
      ? await this.resolveEncKit(
          {
            id: options.encrypt?.kid,
            algorithm: options.encrypt?.algorithm,
            predicate: options.encrypt?.predicate,
          },
          explicitEncrypt,
        )
      : undefined;

    // `sensitive_identity` MUST NOT travel in cleartext. If it cannot be
    // encrypted (profile not encryptable, or no enc key resolvable), strip it
    // from the content before signing so the claim is omitted entirely.
    const signContent =
      hasSensitiveIdentity && !jweKit
        ? (removeUndefined({ ...content, sensitiveIdentity: undefined }) as SignContent)
        : content;

    // Assemble + validate on the DOMAIN-keyed common layer: presence/forbid/
    // conditional policy (inside assembleCommonClaims) + the structural RFC
    // rules (validateProfileClaims). Business logic lives in domain terms.
    const common = assembleCommonClaims(
      { algorithm: kit.algorithm, issuer: this.issuer },
      profile,
      signContent,
      options,
    );

    validateProfileClaims(profile, common, {
      ...(options.context ?? {}),
      algorithm: kit.algorithm as any,
    });

    // JOSE wire claims: the existing wire mapper, fed the envelope ALREADY
    // resolved on the common layer (iss/iat/jti/nbf/exp) so the signed token
    // matches the validated common layer exactly — one source of truth, and
    // byte-identical to the pre-rebase output.
    const claims = buildProfileClaims(
      { algorithm: kit.algorithm, issuer: this.issuer },
      profile,
      {
        ...signContent,
        notBefore: common.notBefore as Date | undefined,
        issuer: common.issuer as string | undefined,
        expires: common.expiresAt as Date | undefined,
      } as SignContent,
      {
        ...options,
        issuedAt: common.issuedAt as Date | undefined,
        tokenId: common.tokenId as string | undefined,
      },
    );

    // A profile typ stamps the header verbatim (e.g. `at+jwt`). A `null` profile
    // typ means "none mandated": fall back to the tokenType-derived default
    // (bare `JWT` when no tokenType), which JwtKit requires as a header floor.
    const signed = kit.signClaims(claims, signContent as SignJwtContent, {
      ...options,
      ...(profile.typ !== null ? { typ: profile.typ } : {}),
    });

    if (!jweKit) {
      return signed;
    }

    // T5 — sign-then-encrypt. The inner signed JWT keeps the profile typ
    // (`at+jwt` / bare `JWT`); the outer JWE carries `cty: application/jwt`
    // (set automatically by JweKit.encrypt from the inner-token shape). The
    // read side (verifySmart recursion) decrypts then verifies the inner JWT,
    // applying the profile floor to the inner claims/typ.
    const { token } = jweKit.encrypt(signed.token);

    return { ...signed, token };
  }

  // The COSE encoder. Consumes the SAME domain-keyed common claims
  // (assembleCommonClaims) and profile validation as the JOSE path; only the
  // wire encoding differs — a signed CWT (COSE_Sign1) wrapped in the CWT tag.
  // The token bytes are base64url-encoded so the string-token API is preserved.
  private async mintCose(
    name: string,
    content: SignContent,
    options: ProfileSignOptions,
  ): Promise<SignedJwt> {
    const profile = resolveProfile(name);
    const kryptos = await this.kryptosSig({ sign: true });

    const common = assembleCommonClaims(
      { algorithm: kryptos.algorithm, issuer: this.issuer },
      profile,
      content,
      options,
    );
    validateProfileClaims(profile, common, {
      ...(options.context ?? {}),
      algorithm: kryptos.algorithm as any,
    });

    const token = new CwtKit({ kryptos, logger: this.logger }).sign(common, {
      typ: profile.typ ?? undefined,
    });

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
    const bytes = Buffer.from(token, "base64url");

    // Decode the COSE headers (kid/alg/typ) WITHOUT verifying, resolve the key
    // by kid through amphora (kid-only, no header-embedded key), then verify.
    const decoded = CwtKit.decode(bytes);
    const kryptos = await this.kryptosSig({ id: decoded.kid });

    const { claims, typ } = new CwtKit({ kryptos, logger: this.logger }).verify(bytes);

    const expectedIssuer =
      options.issuer ??
      (profile.issuer === "platform" ? (this.issuer ?? undefined) : undefined);

    enforceVerifyFloor({
      audience: options.audience,
      decodedTyp: typ,
      expectedIssuer,
      payload: claims,
      profile,
    });

    return { claims, header: decoded } as unknown as T;
  }

  private async resolveEncKit(
    options: {
      id?: string;
      algorithm?: KryptosEncAlgorithm;
      predicate?: AegisPredicate;
    },
    required: boolean,
  ): Promise<JweKit | undefined> {
    try {
      return await this.jweKit({ encrypt: true, ...options });
    } catch (error) {
      // An explicit `encrypt` option means the caller demanded encryption, so a
      // missing enc key must surface as an error.
      if (required) {
        throw error;
      }

      // Encryption was forced only by `sensitive_identity` and no enc key is
      // resolvable. Encryption is skipped; the claim is omitted rather than
      // leaked in cleartext (token-claims.md:98).
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
    const parsed = await this.verifySmart<ParsedJwt>(token, rest);

    const expectedIssuer =
      options.issuer ??
      (profile.issuer === "platform" ? (this.issuer ?? undefined) : undefined);

    enforceVerifyFloor({
      audience: options.audience,
      decodedTyp: parsed.decoded.header.typ,
      expectedIssuer,
      // DOMAIN-keyed parsed payload (issuer/audience/expiresAt), not the raw
      // wire claims — the floor reads domain names so it is format-agnostic.
      payload: parsed.payload as Dict,
      profile,
    });

    return parsed as T;
  }

  private async jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify: VerifyJwtOptions = {},
  ): Promise<ParsedJwt<T>> {
    const decode = JwtKit.decode(jwt);

    const kit = await this.jwtKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosSigAlgorithm,
    });

    return kit.verify(jwt, verify);
  }

  // private kryptos

  private async kryptosEnc(options: EncOptions = {}): Promise<IKryptos> {
    const query: AmphoraPredicate = options.encrypt
      ? {
          $or: [
            { operations: ["encrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["wrapKey"] },
          ],
          algorithm: options.algorithm ?? this.encAlgorithm,
          issuer: this.issuer ?? undefined,
          ...(options.predicate ?? {}),
        }
      : {
          $or: [
            { operations: ["decrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["unwrapKey"] },
          ],
          algorithm: options.algorithm ?? this.encAlgorithm,
          ...(options.predicate ?? {}),
        };

    const kryptos = options.id
      ? await this.amphora.findById(options.id)
      : await this.amphora.find({ ...query, use: "enc" });

    this.logger.debug("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }

  private async kryptosSig(options: SigOptions = {}): Promise<IKryptos> {
    // SECURITY INVARIANT: verification keys are ALWAYS sourced from Amphora.
    // The JOSE header parameters `jku`, `jwk`, `x5u`, `x5c`, `x5t`, and
    // `x5t#S256` are never trusted as key sources during verification, even
    // if present in the token header. This closes the "header-embedded key"
    // attack class (CVE-class vulnerabilities that have hit multiple other
    // JOSE libraries where the verifier naively used the header-supplied
    // key to validate the signature).
    //
    // The only input the verifier accepts from the header is `kid`, which
    // is used as a lookup key into Amphora — never as a key itself.
    const query: AmphoraPredicate = options.sign
      ? {
          algorithm: this.sigAlgorithm,
          issuer: this.issuer ?? undefined,
          operations: ["sign"],
          ...(options.predicate ?? {}),
        }
      : {
          algorithm: options.algorithm ?? this.sigAlgorithm,
          operations: ["verify"],
          ...(options.predicate ?? {}),
        };

    const kryptos = options.id
      ? await this.amphora.findById(options.id)
      : await this.amphora.find({ ...query, use: "sig" });

    this.logger.debug("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }
}
