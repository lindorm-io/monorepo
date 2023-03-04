import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/core-logger";
import { TokenError } from "../error";
import { camelCase, snakeCase } from "@lindorm-io/case";
import { decode, Jwt, sign, verify } from "jsonwebtoken";
import { expiryObject } from "@lindorm-io/expiry";
import { randomUUID } from "crypto";
import { removeUndefinedFromObject, sortObjectKeys } from "@lindorm-io/core";
import {
  assertClaimDifference,
  assertClaimEquals,
  assertClaimIncludes,
  assertGreaterOrEqual,
  getUnixTime,
} from "../util/private";
import {
  JwtDecodeData,
  JwtDecodedClaims,
  JwtOptions,
  JwtSignData,
  JwtSignOptions,
  JwtVerifyOptions,
} from "../types";
import {
  AdjustedAccessLevel,
  LevelOfAssurance,
  LindormTokenClaims,
} from "@lindorm-io/common-types";

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

  public sign<Payload = Record<string, any>, Claims = Record<string, any>>(
    options: JwtSignOptions<Payload, Claims>,
  ): JwtSignData {
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
      auth_time: options.authTime,
      azp: options.authorizedParty,
      nonce: options.nonce,
      sid: options.session,

      // optional lindorm claims
      aal: options.adjustedAccessLevel,
      cid: options.client,
      loa: options.levelOfAssurance,
      scp: options.scopes,
      sih: options.sessionHint,
      suh: options.subjectHint,
      tid: options.tenant,
      usr: options.username,

      // payload & claims
      ...(options.payload ? { ext: snakeCase(options.payload) } : {}),
      ...(options.claims ? snakeCase(options.claims) : {}),
    };

    const key = this.keystore.getSigningKey(options.keyType || this.keyType);

    const privateKey = key.privateKey as string;
    const signingKey =
      key.type === KeyType.RSA ? { passphrase: key.passphrase || "", key: privateKey } : privateKey;
    const keyInfo = { algorithm: key.preferredAlgorithm, keyid: key.id };

    const token = sign(sortObjectKeys(removeUndefinedFromObject(object)), signingKey, keyInfo);

    this.logger.debug("sign token success", { token, ...object, ...keyInfo });

    return {
      id,
      expires,
      expiresIn,
      expiresUnix,
      token,
    };
  }

  public verify<Payload = Record<string, any>, Claims = Record<string, any>>(
    token: string,
    options: JwtVerifyOptions = {},
  ): JwtDecodedClaims<Payload, Claims> {
    this.logger.debug("verify token", { token, options });

    const claims = JWT.decodeFormatted<Payload, Claims>(token);
    const { algorithms, publicKey } = this.keystore.getKey(claims.keyId);
    const {
      adjustedAccessLevel,
      audience,
      authorizedParty,
      client,
      clockTolerance,
      issuer = this.issuer,
      levelOfAssurance,
      maxAge,
      nonce,
      scopes,
      session,
      subject,
      subjectHints,
      tenant,
      types,
    } = options;

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

  public static decode(token: string): Jwt | null {
    return decode(token, { complete: true });
  }

  public static decodeFormatted<Payload = Record<string, any>, Claims = Record<string, any>>(
    token: string,
  ): JwtDecodeData<Payload, Claims> {
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
      scp,
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
      audiences: aud,
      authContextClass: acr || null,
      authMethodsReference: amr || [],
      authTime: auth_time || null,
      authorizedParty: azp || null,
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
      payload: ext ? camelCase<Payload>(ext) : ({} as Payload),
      scopes: scp || [],
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
}
