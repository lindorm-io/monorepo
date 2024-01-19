import { camelCase, snakeCase } from "@lindorm-io/case";
import { OpenIdGrantType } from "@lindorm-io/common-enums";
import {
  AdjustedAccessLevel,
  LevelOfAssurance,
  LindormTokenClaims,
} from "@lindorm-io/common-types";
import { removeUndefinedFromObject, sortObjectKeys } from "@lindorm-io/core";
import { Logger } from "@lindorm-io/core-logger";
import { expiryObject } from "@lindorm-io/expiry";
import { KeySetType, WebKeySet } from "@lindorm-io/jwk";
import { Keystore } from "@lindorm-io/keystore";
import { createHash, randomUUID } from "crypto";
import { Algorithm, Jwt, Secret, SignOptions, decode, sign, verify } from "jsonwebtoken";
import { TokenError } from "../error";
import { JwtAlg, JwtDecode, JwtOptions, JwtSign, JwtSignOptions, JwtVerifyOptions } from "../types";
import {
  assertClaimDifference,
  assertClaimEquals,
  assertClaimIncludes,
  assertGreaterOrEqual,
  getFirstBitsFromBuffer,
  getHashAlgFromKey,
  getUnixTime,
} from "../util/private";

export class JWT {
  readonly #clockTolerance: number;
  readonly #issuer: string;
  readonly #jwksUrl: string | undefined;
  readonly #keystore: Keystore;
  readonly #keyType: KeySetType | undefined;
  readonly #logger: Logger;

  public constructor(options: JwtOptions, keystore: Keystore, logger: Logger) {
    this.#logger = logger.createChildLogger(["jwt"]);

    this.#clockTolerance = options.clockTolerance || 0;
    this.#issuer = options.issuer;
    this.#jwksUrl = options.jwksUrl;
    this.#keystore = keystore;
    this.#keyType = options.keyType;
  }

  public sign<Claims = Record<string, any>>(options: JwtSignOptions<Claims>): JwtSign {
    const {
      id = randomUUID(),
      adjustedAccessLevel,
      audiences,
      authContextClass,
      authFactorReference,
      authMethodsReference,
      authorizedParty,
      authTime,
      claims,
      client,
      grantType,
      issuedAt,
      jwksUrl = this.#jwksUrl,
      keyType,
      levelOfAssurance,
      nonce,
      notBefore,
      roles,
      scopes,
      session,
      sessionHint,
      subject,
      subjectHint,
      tenant,
      type,
    } = options;

    const { expires, expiresIn, expiresUnix, now } = expiryObject(options.expiry);

    const accessTokenHash = options.accessTokenHash
      ? options.accessTokenHash
      : options.accessToken
      ? this.createHash(options.accessToken, 128)
      : undefined;

    const codeHash = options.codeHash
      ? options.codeHash
      : options.code
      ? this.createHash(options.code, 256)
      : undefined;

    this.#logger.debug("Signing token", {
      options,
    });

    const object: LindormTokenClaims = {
      // required claims
      aud: audiences,
      exp: expiresUnix,
      iat: getUnixTime(issuedAt || now),
      iss: this.#issuer,
      jti: id,
      nbf: getUnixTime(notBefore || now),
      sub: subject,
      token_type: type,

      // optional standard claims
      acr: authContextClass,
      afr: authFactorReference,
      amr: authMethodsReference,
      at_hash: accessTokenHash,
      auth_time: authTime,
      azp: authorizedParty,
      c_hash: codeHash,
      nonce: nonce,
      sid: session,

      // optional lindorm claims
      aal: adjustedAccessLevel,
      cid: client,
      gty: grantType,
      loa: levelOfAssurance,
      rls: roles,
      scope: scopes?.join(" "),
      sih: sessionHint,
      suh: subjectHint,
      tid: tenant,

      // remaining claims
      ...(claims ? snakeCase(claims) : {}),
    };

    const key = this.getSigningKey(keyType);
    const privateKey = this.getSecret(key);
    const signOptions = this.getSignOptions(key, jwksUrl);
    const payload = sortObjectKeys(removeUndefinedFromObject(object));

    const token = sign(payload, privateKey, signOptions);

    this.#logger.debug("Successfully signed token", {
      token,
      claims: object,
      options: signOptions,
    });

    return {
      id,
      expires,
      expiresIn,
      expiresUnix,
      token,
    };
  }

  public verify<Claims = Record<string, never>>(
    token: string,
    options: JwtVerifyOptions = {},
  ): JwtDecode<Claims> {
    this.#logger.debug("verify token", { token, options });

    const payload = JWT.decodePayload<Claims>(token);
    const {
      accessTokenHash,
      adjustedAccessLevel,
      audience,
      authorizedParty,
      client,
      clockTolerance,
      codeHash,
      grantType,
      issuer = this.#issuer,
      levelOfAssurance,
      maxAge,
      nonce,
      roles,
      scopes,
      secret,
      session,
      subject,
      subjectHints,
      tenant,
      types,
    } = options;

    let algorithms: Array<JwtAlg>;
    let verifyKey: Secret;

    if (secret) {
      algorithms = options.algorithms || ["HS256"];
      verifyKey = secret;
    } else if (payload.key.id) {
      const found = this.#keystore.getKey(payload.key.id);
      const pem = found.export("pem");

      if (pem.type === "OKP") {
        throw new TokenError("Unsupported key type");
      }

      algorithms = [found.metadata.algorithm as JwtAlg];
      verifyKey = WebKeySet.isOctPem(pem) ? pem.privateKey : pem.publicKey;

      if (!verifyKey) {
        throw new TokenError("Missing verification key");
      }
    } else {
      throw new TokenError("Missing keyId or secret");
    }

    try {
      verify(token, verifyKey, {
        algorithms,
        audience,
        clockTimestamp: getUnixTime(),
        clockTolerance: clockTolerance || this.#clockTolerance,
        issuer,
        maxAge,
        nonce,
        subject,
      });
    } catch (err: any) {
      this.#logger.error("Failed to verify token", err);

      throw new TokenError("Invalid token", { error: err });
    }

    try {
      if (adjustedAccessLevel) {
        assertGreaterOrEqual(adjustedAccessLevel, payload.metadata.adjustedAccessLevel, "aal");
      }

      if (authorizedParty) {
        assertClaimEquals(authorizedParty, payload.metadata.authorizedParty, "azp");
      }

      if (accessTokenHash) {
        assertClaimEquals(accessTokenHash, payload.metadata.accessTokenHash, "at_hash");
      }

      if (client) {
        assertClaimEquals(client, payload.metadata.client, "cid");
      }

      if (codeHash) {
        assertClaimEquals(codeHash, payload.metadata.codeHash, "c_hash");
      }

      if (grantType) {
        assertClaimEquals(grantType, payload.metadata.grantType, "gty");
      }

      if (levelOfAssurance) {
        assertGreaterOrEqual(levelOfAssurance, payload.metadata.levelOfAssurance, "loa");
      }

      if (roles?.length) {
        assertClaimDifference(roles, payload.metadata.roles, "rls");
      }

      if (scopes?.length) {
        assertClaimDifference(scopes, payload.metadata.scopes, "scp");
      }

      if (types?.length) {
        assertClaimIncludes(types, payload.metadata.type, "token_type");
      }

      if (session) {
        assertClaimEquals(session, payload.metadata.session, "sid");
      }

      if (subjectHints?.length) {
        assertClaimIncludes(subjectHints, payload.metadata.subjectHint, "suh");
      }

      if (tenant) {
        assertClaimEquals(tenant, payload.metadata.tenant, "tid");
      }

      this.#logger.debug("verify token success", { claims: payload });

      return payload;
    } catch (err: any) {
      this.#logger.error("Failed to validate token", err);

      throw err;
    }
  }

  public static decode(token: string): Jwt | null {
    return decode(token, { complete: true });
  }

  public static decodePayload<Claims = Record<string, never>>(token: string): JwtDecode<Claims> {
    const {
      header: { alg: algorithm, jku, kid: keyId },
      payload: object,
    } = decode(token, { complete: true }) as unknown as {
      header: any;
      payload: LindormTokenClaims & { [key: string]: any };
    };

    const now = getUnixTime();

    const {
      aal,
      acr,
      afr,
      amr,
      at_hash,
      aud,
      auth_time,
      azp,
      c_hash,
      cid,
      exp,
      gty,
      iat,
      iss,
      jti,
      loa,
      nbf,
      nonce,
      rls,
      scope,
      sid,
      sih,
      sub,
      suh,
      tid,
      token_type,
      ...rest
    } = object;

    const claims = rest ? camelCase<Claims>(rest) : ({} as Claims);

    return {
      id: jti,
      claims,
      key: {
        id: keyId,
        algorithm,
        jwksUrl: jku ?? null,
      },
      metadata: {
        accessTokenHash: at_hash ?? null,
        active: iat <= now && nbf <= now && exp >= now,
        adjustedAccessLevel: (aal as AdjustedAccessLevel) ?? 0,
        audiences: aud,
        authContextClass: acr ?? null,
        authFactorReference: afr ?? null,
        authMethodsReference: amr ?? [],
        authorizedParty: azp ?? null,
        authTime: auth_time ?? null,
        client: cid ?? null,
        codeHash: c_hash ?? null,
        expires: exp,
        expiresIn: exp - now,
        grantType: (gty as OpenIdGrantType) ?? null,
        issuedAt: iat,
        issuer: iss,
        levelOfAssurance: (loa as LevelOfAssurance) ?? 0,
        nonce: nonce ?? null,
        notBefore: nbf,
        now,
        roles: rls ?? [],
        scopes: scope ? scope.split(" ") : [],
        session: sid ?? null,
        sessionHint: sih ?? null,
        subjectHint: suh ?? null,
        tenant: tid ?? null,
        type: token_type,
      },
      subject: sub,
      token,
    };
  }

  public createHash(input: string, bits: number, keyType?: KeySetType): string {
    const key = this.getSigningKey(keyType);
    const alg = getHashAlgFromKey(key);
    const buffer = createHash(alg).update(input, "utf8").digest();

    return getFirstBitsFromBuffer(buffer, bits);
  }

  private getSecret(key: WebKeySet): Secret {
    const pem = key.export("pem");

    if (!pem.privateKey) {
      throw new TokenError("Missing private key");
    }

    this.#logger.silly("Resolving secret key", { key: key.metadata });

    return pem.privateKey;
  }

  private getSigningKey(keyType?: KeySetType): WebKeySet {
    this.#logger.silly("Finding signing key", { keyType });

    const key = this.#keystore.findKey("sig", keyType || this.#keyType);

    this.#logger.silly("Found signing key", { keyType, key: key.metadata });

    return key;
  }

  private getSignOptions(key: WebKeySet, jwksUrl?: string): SignOptions {
    const options: SignOptions = {
      algorithm: key.algorithm as Algorithm,
      allowInsecureKeySizes: true,
      header: {
        alg: key.algorithm,
        jku: jwksUrl,
        kid: key.id,
      },
    };

    this.#logger.silly("Resolving sign options", { key: key.metadata, jwksUrl, options });

    return options;
  }
}
