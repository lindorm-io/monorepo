import { isJwt } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { JwtError } from "../errors";
import { IJwtKit } from "../interfaces";
import {
  DecodedJwt,
  JwtKitOptions,
  Operators,
  ParsedJwt,
  ParsedJwtHeader,
  ParsedJwtPayload,
  SignJwtContent,
  SignJwtOptions,
  SignedJwt,
  TokenHeaderSignOptions,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../types";
import {
  createJwtValidate,
  createJwtVerify,
  createTokenSignature,
  decodeJwtPayload,
  decodeTokenHeader,
  encodeJwtPayload,
  encodeTokenHeader,
  parseJwtPayload,
  parseTokenHeader,
  validate,
  validateValue,
  verifyTokenSignature,
} from "../utils/private";

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
      throw new JwtError("Issuer is required to sign JWT");
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
  ): ParsedJwt<C> {
    const parsed = JwtKit.parse<C>(jwt);

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwtError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
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

    const {
      decoded: { payload },
    } = parsed;

    const withDates = {
      ...payload,
      exp: payload.exp ? new Date(payload.exp * 1000) : undefined,
      iat: payload.iat ? new Date(payload.iat * 1000) : undefined,
      nbf: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
      auth_time: payload.auth_time ? new Date(payload.auth_time * 1000) : undefined,
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

    return parsed;
  }

  // public static

  public static isJwt(jwt: string): boolean {
    return isJwt(jwt);
  }

  public static decode<C extends Dict = Dict>(jwt: string): DecodedJwt<C> {
    const [header, payload, signature] = jwt.split(".");

    return {
      header: decodeTokenHeader(header),
      payload: decodeJwtPayload<C>(payload),
      signature,
    };
  }

  public static parse<C extends Dict = Dict>(token: string): ParsedJwt<C> {
    const decoded = JwtKit.decode<C>(token);

    if (decoded.header.typ !== "JWT") {
      throw new JwtError("Invalid token", {
        data: { typ: decoded.header.typ },
        details: "Header type must be JWT",
      });
    }

    if (!decoded.payload.iss) {
      throw new JwtError("Invalid token", {
        data: { iss: decoded.payload.iss },
        details: "Issuer is required to decode JWT",
      });
    }

    const header = parseTokenHeader<ParsedJwtHeader>(decoded.header);

    const payload = parseJwtPayload<C>(decoded.payload);

    return { decoded, header, payload, token };
  }

  public static validate<C extends Dict = Dict>(
    payload: ParsedJwtPayload<C>,
    options: ValidateJwtOptions,
  ): void {
    const operators = createJwtValidate(options);

    validate(payload, operators);
  }
}
