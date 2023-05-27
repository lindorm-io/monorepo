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
import {
  JwtDecodeData,
  JwtDecodedClaims,
  JwtOptions,
  JwtSignData,
  JwtSignOptions,
  JwtVerifyOptions,
} from "../types";
import {
  assertClaimDifference,
  assertClaimEquals,
  assertClaimIncludes,
  assertGreaterOrEqual,
  getFirst128BitsFromBuffer,
  getHashAlgFromKey,
  getUnixTime,
} from "../util/private";

export class JWT {
  private readonly clockTolerance: number;
  private readonly issuer: string;
  private readonly keyType: KeyType | undefined;
  private readonly keystore: Keystore;
  private readonly logger: Logger;

  public constructor(options: JwtOptions, keystore: Keystore, logger: Logger) {
    this.logger = logger.createChildLogger(["jwt"]);

    this.clockTolerance = options.clockTolerance || 5;
    this.issuer = options.issuer;
    this.keyType = options.keyType;
    this.keystore = keystore;
  }

  public sign<Claims = Record<string, any>>(options: JwtSignOptions<Claims>): JwtSignData {
    const id = options.id || randomUUID();

    const { expires, expiresIn, expiresUnix, now } = expiryObject(options.expiry);

    this.logger.debug("sign token", {
      options,
    });

    const object: LindormTokenClaims = {
      // required claims
      aud: options.audiences,
      exp: expiresUnix,
      iat: getUnixTime(options.issuedAt || now),
      iss: this.issuer,
      jti: id,
      nbf: getUnixTime(options.notBefore || now),
      sub: options.subject,
      token_type: options.type,

      // optional standard claims
      acr: options.authContextClass,
      amr: options.authMethodsReference,
      at_hash: options.atHash,
      auth_time: options.authTime,
      azp: options.authorizedParty,
      nonce: options.nonce,
      sid: options.session,

      // optional lindorm claims
      aal: options.adjustedAccessLevel,
      cid: options.client,
      loa: options.levelOfAssurance,
      scope: options.scopes?.join(" "),
      sih: options.sessionHint,
      suh: options.subjectHint,
      tid: options.tenant,
      usr: options.username,

      // remaining claims
      ...(options.claims ? snakeCase(options.claims) : {}),
    };

    const key = this.getSigningKey(options.keyType);
    const privateKey = this.getPrivateKey(key);
    const signOptions = this.getSignOptions(key);

    const payload = sortObjectKeys(removeUndefinedFromObject(object));
    const token = sign(payload, privateKey, signOptions);

    this.logger.debug("sign token success", { token, ...object, ...signOptions });

    return {
      id,
      expires,
      expiresIn,
      expiresUnix,
      token,
    };
  }

  public verify<Claims = Record<string, any>>(
    token: string,
    options: JwtVerifyOptions = {},
  ): JwtDecodedClaims<Claims> {
    this.logger.debug("verify token", { token, options });

    const claims = JWT.decodeFormatted<Claims>(token);
    const {
      adjustedAccessLevel,
      atHash,
      audience,
      authorizedParty,
      client,
      clockTolerance,
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
    } else if (claims.keyId) {
      ({ algorithms, publicKey } = this.keystore.getKey(claims.keyId));
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
        assertGreaterOrEqual(adjustedAccessLevel, claims.adjustedAccessLevel, "aal");
      }

      if (authorizedParty) {
        assertClaimEquals(authorizedParty, claims.authorizedParty, "azp");
      }

      if (atHash) {
        assertClaimEquals(atHash, claims.atHash, "at_hash");
      }

      if (client) {
        assertClaimEquals(client, claims.client, "cid");
      }

      if (levelOfAssurance) {
        assertGreaterOrEqual(levelOfAssurance, claims.levelOfAssurance, "loa");
      }

      if (scopes?.length) {
        assertClaimDifference(scopes, claims.scopes, "scp");
      }

      if (types?.length) {
        assertClaimIncludes(types, claims.type, "token_type");
      }

      if (session) {
        assertClaimEquals(session, claims.session, "sid");
      }

      if (subjectHints?.length) {
        assertClaimIncludes(subjectHints, claims.subjectHint, "suh");
      }

      if (tenant) {
        assertClaimEquals(tenant, claims.tenant, "tid");
      }

      this.logger.debug("verify token success", { claims });

      return claims;
    } catch (err: any) {
      this.logger.error("Failed to validate token", err);

      throw err;
    }
  }

  public createHash(input: string, keyType?: KeyType): string {
    const key = this.getSigningKey(keyType);
    const alg = getHashAlgFromKey(key);
    const buffer = createHash(alg).update(input, "utf8").digest();

    return getFirst128BitsFromBuffer(buffer);
  }

  public static decode(token: string): Jwt | null {
    return decode(token, { complete: true });
  }

  public static decodeFormatted<Claims = Record<string, any>>(
    token: string,
  ): JwtDecodeData<Claims> {
    const {
      header: { kid: keyId },
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
      cid,
      exp,
      ext,
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
      usr,
      ...claims
    } = object;

    return {
      id: jti,
      active: iat <= now && nbf <= now && exp >= now,
      adjustedAccessLevel: (aal as AdjustedAccessLevel) || 0,
      atHash: at_hash || null,
      audiences: aud,
      authContextClass: acr || null,
      authMethodsReference: amr || [],
      authorizedParty: azp || null,
      authTime: auth_time || null,
      claims: claims ? camelCase<Claims>(claims) : ({} as Claims),
      client: cid || null,
      expires: exp,
      expiresIn: exp - now,
      issuedAt: iat,
      issuer: iss,
      keyId,
      levelOfAssurance: (loa as LevelOfAssurance) || 0,
      nonce: nonce || null,
      notBefore: nbf,
      now,
      scopes: scope ? scope.split(" ") : [],
      session: sid || null,
      sessionHint: sih || null,
      subject: sub,
      subjectHint: suh || null,
      tenant: tid || null,
      token,
      type: token_type,
      username: usr || null,
    };
  }

  private getSigningKey(keyType?: KeyType): KeyPair {
    return this.keystore.getSigningKey(keyType || this.keyType);
  }

  private getPrivateKey(key: KeyPair): Secret {
    if (!key.privateKey) throw new Error("Missing private key");

    return key.type === KeyType.RSA
      ? { passphrase: key.passphrase || "", key: key.privateKey }
      : key.privateKey;
  }

  private getSignOptions(key: KeyPair): SignOptions {
    return {
      algorithm: key.preferredAlgorithm,
      allowInsecureKeySizes: true,
      keyid: key.id,
    };
  }
}
