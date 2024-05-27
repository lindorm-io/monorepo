import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { JwtError } from "../errors";
import {
  DecodedJwt,
  IJwtKit,
  JwtKitOptions,
  Operators,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  TokenHeaderSignOptions,
  ValidateJwtOptions,
  VerifiedJwt,
  VerifiedJwtHeader,
  VerifyJwtOptions,
} from "../types";
import { createTokenSignature } from "../utils/private/create-token-signature";
import {
  decodeJwtPayload,
  encodeJwtPayload,
  parseJwtPayload,
} from "../utils/private/jwt-payload";
import { createJwtValidate } from "../utils/private/jwt-validate";
import { createJwtVerify } from "../utils/private/jwt-verify";
import {
  decodeTokenHeader,
  encodeTokenHeader,
  parseTokenHeader,
} from "../utils/private/token-header";
import { validate } from "../utils/private/validate";
import { validateValue } from "../utils/private/validate-value";
import { verifyTokenSignature } from "../utils/private/verify-token-signature";

export class JwtKit implements IJwtKit {
  private readonly clockTolerance: number;
  private readonly issuer: string | null;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: JwtKitOptions) {
    this.logger = options.logger.child(["JwtKit"]);
    this.kryptos = options.kryptos;
    this.issuer = options.issuer ?? null;

    this.clockTolerance = options.clockTolerance ?? 0;
  }

  public sign<C extends Dict = Dict>(
    content: SignJwtContent<C>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    if (!this.issuer) {
      throw new JwtError("Issuer is required to sign JWS");
    }

    const algorithm = this.kryptos.algorithm;
    const jwksUri = this.kryptos.jwksUri;
    const keyId = this.kryptos.id;
    const objectId = options.objectId ?? content.subject ?? randomUUID();

    const headerOptions: TokenHeaderSignOptions = {
      algorithm,
      contentType: "application/json",
      headerType: "JWT",
      jwksUri,
      keyId,
      objectId,
    };

    const header = encodeTokenHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    const { expiresAt, expiresIn, expiresOn, payload, tokenId } = encodeJwtPayload<C>(
      { algorithm, issuer: this.issuer },
      content,
      options,
    );

    this.logger.silly("Token payload encoded", { payload, options: content });

    const signature = createTokenSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    this.logger.silly("Token signature created", { signature });

    const token = `${header}.${payload}.${signature}`;

    this.logger.silly("Token signed", {
      expiresAt,
      expiresIn,
      expiresOn,
      keyId,
      objectId,
      token,
      tokenId,
    });

    return { expiresAt, expiresIn, expiresOn, objectId, token, tokenId };
  }

  public verify<C extends Dict = Dict>(
    jwt: string,
    verify: VerifyJwtOptions = {},
  ): VerifiedJwt<C> {
    const decoded = JwtKit.decode<C>(jwt);

    if (decoded.header.typ !== "JWT") {
      throw new JwtError("Invalid token", {
        data: { typ: decoded.header.typ },
      });
    }

    if (!decoded.payload.iss) {
      throw new JwtError("Invalid token", {
        data: { iss: decoded.payload.iss },
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JwtError("Invalid token", {
        data: { alg: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyTokenSignature(this.kryptos, jwt);

    this.logger.silly("Token signature verified", { verified, token: jwt });

    if (!verified) {
      throw new JwtError("Invalid token", {
        data: { verified, token: jwt },
      });
    }

    const operators = createJwtVerify(
      this.kryptos.algorithm,
      verify,
      this.clockTolerance,
    );
    const invalid: Array<{ key: string; value: any; ops: Operators }> = [];

    const withDates = {
      ...decoded.payload,
      exp: decoded.payload.exp ? new Date(decoded.payload.exp * 1000) : undefined,
      iat: decoded.payload.iat ? new Date(decoded.payload.iat * 1000) : undefined,
      nbf: decoded.payload.nbf ? new Date(decoded.payload.nbf * 1000) : undefined,
      auth_time: decoded.payload.auth_time
        ? new Date(decoded.payload.auth_time * 1000)
        : undefined,
    };

    this.logger.silly("Operators created", { operators });

    for (const [key, ops] of Object.entries(operators)) {
      const value = withDates[key];

      if (validateValue(value, ops)) continue;

      invalid.push({ key, value, ops });
    }

    this.logger.silly("Operators verified", { invalid });

    if (invalid.length) {
      throw new JwtError("Invalid token", { data: { invalid } });
    }

    const header = parseTokenHeader<VerifiedJwtHeader>(decoded.header);
    const payload = parseJwtPayload<C>(decoded.payload);

    this.logger.silly("Token verified", { header, payload });

    return {
      decoded,
      header,
      payload,
      token: jwt,
    };
  }

  // public static

  public static decode<C extends Dict = Dict>(jwt: string): DecodedJwt<C> {
    const [header, payload, signature] = jwt.split(".");

    return {
      header: decodeTokenHeader(header),
      payload: decodeJwtPayload<C>(payload),
      signature,
    };
  }

  public static validate<C extends Dict = Dict>(
    payload: ParsedJwtPayload<C>,
    options: ValidateJwtOptions,
  ): void {
    const operators = createJwtValidate(options);

    validate(payload, operators);
  }
}
