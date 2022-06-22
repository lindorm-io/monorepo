import { ILogger } from "@lindorm-io/winston";
import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { TokenError } from "../error";
import { decode, Jwt, sign, verify } from "jsonwebtoken";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";
import {
  camelKeys,
  getExpires,
  removeUndefinedFromObject,
  snakeKeys,
  sortObjectKeys,
} from "@lindorm-io/core";
import {
  assertClaimDifference,
  assertClaimEquals,
  assertClaimIncludes,
  assertGreaterOrEqual,
} from "../util/private";
import {
  JwtDecodeData,
  JwtOptions,
  JwtSignData,
  JwtSignOptions,
  JwtVerifyData,
  JwtVerifyOptions,
  LevelOfAssurance,
  LindormClaims,
} from "../types";

export class JWT {
  private readonly clockTolerance: number;
  private readonly issuer: string;
  private readonly keyType: KeyType | undefined;
  private readonly keystore: Keystore;
  private readonly logger: ILogger;

  public constructor(options: JwtOptions) {
    this.clockTolerance = options.clockTolerance || 500;
    this.issuer = options.issuer;
    this.keyType = options.keyType;
    this.keystore = options.keystore;
    this.logger = options.logger.createChildLogger(["jwt"]);
  }

  public sign<Payload = Record<string, any>, Claims = Record<string, any>>(
    options: JwtSignOptions<Payload, Claims>,
  ): JwtSignData {
    const id = options.id || randomUUID();

    const { expires, expiresIn, expiresUnix, now, nowUnix } = getExpires(options.expiry);

    this.logger.debug("sign token", {
      options,
    });

    const object: LindormClaims = {
      // required claims
      aud: options.audiences,
      exp: expiresUnix,
      iat: nowUnix,
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
      sid: options.sessionId,

      // optional lindorm claims
      aal: options.adjustedAccessLevel,
      loa: options.levelOfAssurance,
      iam: options.permissions,
      scp: options.scopes,
      sih: options.sessionHint,
      suh: options.subjectHint,
      usr: options.username,

      // payload & claims
      ...(options.payload ? { ext: snakeKeys(options.payload) } : {}),
      ...(options.claims ? snakeKeys(options.claims) : {}),
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
    options: Partial<JwtVerifyOptions> = {},
  ): JwtVerifyData<Payload, Claims> {
    this.logger.debug("verify token", { token, options });

    const { keyId, ...claims } = JWT.decodeFormatted<Payload, Claims>(token);
    const { algorithms, publicKey } = this.keystore.getKey(keyId);
    const {
      adjustedAccessLevel,
      audience,
      audiences,
      authorizedParty,
      clockTolerance,
      issuer = this.issuer,
      levelOfAssurance,
      maxAge,
      nonce,
      permissions,
      scopes,
      subject,
      subjectHint,
      subjects,
      types,
    } = options;

    try {
      verify(token, publicKey, {
        algorithms,
        audience,
        clockTimestamp: getUnixTime(new Date()),
        clockTolerance: clockTolerance || this.clockTolerance,
        issuer,
        maxAge,
        nonce,
        subject,
      });
    } catch (err: any) {
      throw new TokenError("Invalid token", { error: err });
    }

    if (adjustedAccessLevel) {
      assertGreaterOrEqual(adjustedAccessLevel, claims.adjustedAccessLevel, "aal");
    }

    if (audiences) {
      assertClaimDifference(audiences, claims.audiences, "aud");
    }

    if (authorizedParty) {
      assertClaimEquals(authorizedParty, claims.authorizedParty, "azp");
    }

    if (levelOfAssurance) {
      assertGreaterOrEqual(levelOfAssurance, claims.levelOfAssurance, "loa");
    }

    if (permissions) {
      assertClaimDifference(permissions, claims.permissions, "iam");
    }

    if (scopes) {
      assertClaimDifference(scopes, claims.scopes, "scp");
    }

    if (types) {
      assertClaimIncludes(types, claims.type, "token_type");
    }

    if (subjects) {
      assertClaimIncludes(subjects, claims.subject, "sub");
    }

    if (subjectHint) {
      assertClaimEquals(subjectHint, claims.subjectHint, "suh");
    }

    this.logger.debug("verify token success", { claims });

    return {
      token,
      ...claims,
    };
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
      payload: LindormClaims & { [key: string]: any };
    };

    const now = getUnixTime(new Date());
    const {
      aal,
      acr,
      amr,
      aud,
      auth_time,
      azp,
      exp,
      ext,
      iam,
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
      token_type,
      usr,
      ...claims
    } = object;

    return {
      id: jti,
      active: iat <= now && nbf <= now && exp >= now,
      adjustedAccessLevel: (aal as LevelOfAssurance) || 0,
      audiences: aud,
      authContextClass: acr || [],
      authMethodsReference: amr || [],
      authTime: auth_time || null,
      authorizedParty: azp || null,
      claims: claims ? camelKeys<Claims>(claims) : ({} as Claims),
      expires: exp,
      expiresIn: exp - now,
      issuedAt: iat,
      issuer: iss,
      keyId,
      levelOfAssurance: (loa as LevelOfAssurance) || 0,
      nonce: nonce || null,
      notBefore: nbf,
      now,
      payload: ext ? camelKeys<Payload>(ext) : ({} as Payload),
      permissions: iam || [],
      scopes: scp || [],
      sessionId: sid || null,
      sessionHint: sih || null,
      subject: sub,
      subjectHint: suh || null,
      type: token_type,
      username: usr || null,
    };
  }
}
