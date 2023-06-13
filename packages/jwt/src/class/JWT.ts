import { camelCase, snakeCase } from "@lindorm-io/case";
import {
  AdjustedAccessLevel,
  LevelOfAssurance,
  LindormTokenClaims,
} from "@lindorm-io/common-types";
import { removeUndefinedFromObject, sortObjectKeys } from "@lindorm-io/core";
import { Logger } from "@lindorm-io/core-logger";
import { expiryObject } from "@lindorm-io/expiry";
import { KeyPair, KeyType, Keystore } from "@lindorm-io/key-pair";
import { createHash, randomUUID } from "crypto";
import { Algorithm, Jwt, Secret, SignOptions, decode, sign, verify } from "jsonwebtoken";
import { TokenError } from "../error";
import { JwtDecode, JwtOptions, JwtSign, JwtSignOptions, JwtVerifyOptions } from "../types";
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
  private readonly clockTolerance: number;
  private readonly issuer: string;
  private readonly jwksUrl: string | undefined;
  private readonly keystore: Keystore;
  private readonly keyType: KeyType | undefined;
  private readonly logger: Logger;

  public constructor(options: JwtOptions, keystore: Keystore, logger: Logger) {
    this.logger = logger.createChildLogger(["jwt"]);

    this.clockTolerance = options.clockTolerance || 0;
    this.issuer = options.issuer;
    this.jwksUrl = options.jwksUrl;
    this.keystore = keystore;
    this.keyType = options.keyType;
  }

  public sign<Claims = Record<string, any>>(options: JwtSignOptions<Claims>): JwtSign {
    const {
      id = randomUUID(),
      adjustedAccessLevel,
      audiences,
      authContextClass,
      authMethodsReference,
      authorizedParty,
      authTime,
      claims,
      client,
      issuedAt,
      jwksUrl = this.jwksUrl,
      keyType,
      levelOfAssurance,
      nonce,
      notBefore,
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

    this.logger.debug("Signing token", {
      options,
    });

    const object: LindormTokenClaims = {
      // required claims
      aud: audiences,
      exp: expiresUnix,
      iat: getUnixTime(issuedAt || now),
      iss: this.issuer,
      jti: id,
      nbf: getUnixTime(notBefore || now),
      sub: subject,
      token_type: type,

      // optional standard claims
      acr: authContextClass,
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
      loa: levelOfAssurance,
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

    this.logger.debug("Successfully signed token", { token, ...object, ...signOptions });

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
    this.logger.debug("verify token", { token, options });

    const payload = JWT.decodePayload<Claims>(token);
    const {
      accessTokenHash,
      adjustedAccessLevel,
      audience,
      authorizedParty,
      client,
      clockTolerance,
      codeHash,
      issuer = this.issuer,
      levelOfAssurance,
      maxAge,
      nonce,
      scopes,
      secret,
      session,
      subject,
      subjectHints,
      tenant,
      types,
    } = options;

    let algorithms: Array<Algorithm>;
    let publicKey: Secret;

    if (secret) {
      algorithms = options.algorithms || ["HS256"];
      publicKey = secret;
    } else if (payload.key.id) {
      ({ algorithms, publicKey } = this.keystore.getKey(payload.key.id));
    } else {
      throw new TokenError("Missing keyId or secret");
    }

    try {
      verify(token, publicKey, {
        algorithms,
        audience,
        clockTimestamp: getUnixTime(),
        clockTolerance: clockTolerance || this.clockTolerance,
        issuer,
        maxAge,
        nonce,
        subject,
      });
    } catch (err: any) {
      this.logger.error("Failed to verify token", err);

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

      if (levelOfAssurance) {
        assertGreaterOrEqual(levelOfAssurance, payload.metadata.levelOfAssurance, "loa");
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

      this.logger.debug("verify token success", { claims: payload });

      return payload;
    } catch (err: any) {
      this.logger.error("Failed to validate token", err);

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
      amr,
      at_hash,
      aud,
      auth_time,
      azp,
      c_hash,
      cid,
      exp,
      iat,
      iss,
      jti,
      loa,
      nbf,
      nonce,
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
        jwksUrl: jku || null,
      },
      metadata: {
        accessTokenHash: at_hash || null,
        active: iat <= now && nbf <= now && exp >= now,
        adjustedAccessLevel: (aal as AdjustedAccessLevel) || 0,
        audiences: aud,
        authContextClass: acr || null,
        authMethodsReference: amr || [],
        authorizedParty: azp || null,
        authTime: auth_time || null,
        client: cid || null,
        codeHash: c_hash || null,
        expires: exp,
        expiresIn: exp - now,
        issuedAt: iat,
        issuer: iss,
        levelOfAssurance: (loa as LevelOfAssurance) || 0,
        nonce: nonce || null,
        notBefore: nbf,
        now,
        scopes: scope ? scope.split(" ") : [],
        session: sid || null,
        sessionHint: sih || null,
        subjectHint: suh || null,
        tenant: tid || null,
        type: token_type,
      },
      subject: sub,
      token,
    };
  }

  public createHash(input: string, bits: number, keyType?: KeyType): string {
    const key = this.getSigningKey(keyType);
    const alg = getHashAlgFromKey(key);
    const buffer = createHash(alg).update(input, "utf8").digest();

    return getFirstBitsFromBuffer(buffer, bits);
  }

  private getSecret(key: KeyPair): Secret {
    if (!key.privateKey) throw new Error("Missing private key");

    return key.type === KeyType.RSA
      ? { passphrase: key.passphrase || "", key: key.privateKey }
      : key.privateKey;
  }

  private getSigningKey(keyType?: KeyType): KeyPair {
    return this.keystore.getSigningKey(keyType || this.keyType);
  }

  private getSignOptions(key: KeyPair, jwksUrl?: string): SignOptions {
    return {
      algorithm: key.preferredAlgorithm,
      allowInsecureKeySizes: true,
      header: {
        alg: key.preferredAlgorithm,
        jku: jwksUrl,
        kid: key.id,
      },
    };
  }
}
