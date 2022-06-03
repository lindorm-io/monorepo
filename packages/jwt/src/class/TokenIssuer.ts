import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";
import { TokenError } from "../error";
import { assertClaimDifference, assertClaimEquals, assertClaimIncludes } from "../util/private";
import { camelKeys, getExpires, snakeKeys, sortObjectKeys } from "@lindorm-io/core";
import { decode, sign, verify } from "jsonwebtoken";
import { getUnixTime } from "date-fns";
import { randomUUID } from "crypto";
import {
  IssuerDecodeData,
  IssuerOptions,
  IssuerSignData,
  IssuerSignOptions,
  IssuerVerifyData,
  IssuerVerifyOptions,
  StandardClaims,
} from "../types";

export class TokenIssuer {
  private readonly clockTolerance: number;
  private readonly issuer: string;
  private readonly keyType: KeyType | undefined;
  private readonly keystore: Keystore;
  private readonly logger: ILogger;

  public constructor(options: IssuerOptions) {
    this.clockTolerance = options.clockTolerance || 500;
    this.issuer = options.issuer;
    this.keyType = options.keyType;
    this.keystore = options.keystore;
    this.logger = options.logger.createChildLogger(["TokenIssuer"]);
  }

  public sign<
    Payload extends Record<string, any> = Record<string, any>,
    Claims extends Record<string, any> = Record<string, any>,
  >(options: IssuerSignOptions<Payload, Claims>): IssuerSignData {
    const id = options.id || randomUUID();

    const { expires, expiresIn, expiresUnix, now, nowUnix } = getExpires(options.expiry);

    this.logger.debug("sign token", {
      options,
    });

    const object: StandardClaims = {
      // required claims
      aud: options.audiences,
      exp: expiresUnix,
      iat: nowUnix,
      iss: this.issuer,
      jti: id,
      nbf: getUnixTime(options.notBefore || now),
      sub: options.subject,
      token_type: options.type,

      // optional claims
      ...(options.authContextClass ? { acr: options.authContextClass } : {}),
      ...(options.authMethodsReference ? { amr: options.authMethodsReference } : {}),
      ...(options.authTime ? { auth_time: options.authTime } : {}),
      ...(options.authorizedParty ? { azp: options.authorizedParty } : {}),
      ...(options.levelOfAssurance ? { loa: options.levelOfAssurance } : {}),
      ...(options.payload
        ? { ext: snakeKeys<Payload, Record<string, unknown>>(options.payload) }
        : {}),
      ...(options.permissions ? { iam: options.permissions } : {}),
      ...(options.nonce ? { nonce: options.nonce } : {}),
      ...(options.scopes ? { scp: options.scopes } : {}),
      ...(options.sessionId ? { sid: options.sessionId } : {}),
      ...(options.subjectHint ? { suh: options.subjectHint } : {}),
      ...(options.username ? { usr: options.username } : {}),

      // spread remaining claims
      ...(options.claims ? snakeKeys(options.claims) : {}),
    };

    const key = this.keystore.getSigningKey(options.keyType || this.keyType);

    const privateKey = key.privateKey as string;
    const signingKey =
      key.type === KeyType.RSA ? { passphrase: key.passphrase || "", key: privateKey } : privateKey;
    const keyInfo = { algorithm: key.preferredAlgorithm, keyid: key.id };

    const token = sign(sortObjectKeys(object), signingKey, keyInfo);

    this.logger.debug("sign token success", { token, ...object, ...keyInfo });

    return {
      id,
      expires,
      expiresIn,
      expiresUnix,
      token,
    };
  }

  public verify<
    Payload extends Record<string, any> = Record<string, any>,
    Claims extends Record<string, any> = Record<string, any>,
  >(token: string, options: Partial<IssuerVerifyOptions> = {}): IssuerVerifyData<Payload, Claims> {
    this.logger.debug("verify token", { token, options });

    const { keyId, ...claims } = TokenIssuer.decode<Payload, Claims>(token);
    const { algorithms, publicKey } = this.keystore.getKey(keyId);
    const {
      audience,
      audiences,
      authorizedParty,
      clockTolerance,
      issuer = this.issuer,
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

    if (audiences) {
      assertClaimDifference(audiences, claims.audiences, "aud");
    }

    if (authorizedParty) {
      assertClaimEquals(authorizedParty, claims.authorizedParty, "azp");
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

  public static decode<
    Payload extends Record<string, any> = Record<string, any>,
    Claims extends Record<string, any> = Record<string, any>,
  >(token: string): IssuerDecodeData<Payload, Claims> {
    const {
      header: { kid: keyId },
      payload: object,
    } = decode(token, { complete: true }) as unknown as {
      header: any;
      payload: StandardClaims & { [key: string]: any };
    };

    const now = getUnixTime(new Date());
    const {
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
      sub,
      suh,
      token_type,
      usr,
      ...claims
    } = object;

    return {
      id: jti,
      active: iat <= now && nbf <= now && exp >= now,
      audiences: aud,
      authContextClass: acr || [],
      authMethodsReference: amr || [],
      authTime: auth_time || null,
      authorizedParty: azp || null,
      claims: claims ? camelKeys<Record<string, unknown>, Claims>(claims) : ({} as Claims),
      expires: exp,
      expiresIn: exp - now,
      issuedAt: iat,
      issuer: iss,
      keyId,
      levelOfAssurance: loa || null,
      nonce: nonce || null,
      notBefore: nbf,
      now,
      payload: ext ? camelKeys<Record<string, unknown>, Payload>(ext) : ({} as Payload),
      permissions: iam || [],
      scopes: scp || [],
      sessionId: sid || null,
      subject: sub,
      subjectHint: suh || null,
      type: token_type,
      username: usr || null,
    };
  }
}
