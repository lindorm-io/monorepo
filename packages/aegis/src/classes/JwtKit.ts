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
  TokenHeaderOptions,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../types";
import {
  createJoseSignature,
  createJwtValidate,
  createJwtVerify,
  decodeJoseHeader,
  decodeJwtPayload,
  encodeJoseHeader,
  encodeJwtPayload,
  parseTokenHeader,
  parseTokenPayload,
  validate,
  validateValue,
  verifyJoseSignature,
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
    this.logger.debug("Signing token", { content, options });

    if (!this.issuer) {
      throw new JwtError("Issuer is required to sign JWT");
    }

    const objectId = options.objectId ?? content.subject ?? randomUUID();

    const headerOptions: TokenHeaderOptions = {
      ...(options.header ?? {}),
      algorithm: this.kryptos.algorithm,
      contentType: "application/json",
      headerType: "JWT",
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
    };

    const header = encodeJoseHeader(headerOptions);

    const { expiresAt, expiresIn, expiresOn, payload, tokenId } = encodeJwtPayload<C>(
      { algorithm: this.kryptos.algorithm, issuer: this.issuer },
      content,
      options,
    );

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token });

    return { expiresAt, expiresIn, expiresOn, objectId, token, tokenId };
  }

  public verify<C extends Dict = Dict>(
    token: string,
    verify: VerifyJwtOptions = {},
  ): ParsedJwt<C> {
    this.logger.debug("Verifying token", { token, verify });

    const parsed = JwtKit.parse<C>(token);

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwtError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwtError("Invalid token", {
        data: { verified, token: token },
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

    for (const [key, ops] of Object.entries(operators)) {
      const value = withDates[key];
      if (validateValue(value, ops)) continue;
      invalid.push({ key, value, ops });
    }

    if (invalid.length) {
      throw new JwtError("Invalid token", { data: { invalid } });
    }

    this.logger.debug("Token verified");

    return parsed;
  }

  // public static

  public static isJwt(jwt: string): boolean {
    return isJwt(jwt);
  }

  public static decode<C extends Dict = Dict>(jwt: string): DecodedJwt<C> {
    const [header, payload, signature] = jwt.split(".");

    return {
      header: decodeJoseHeader(header),
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

    const payload = parseTokenPayload<C>(decoded.payload);

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
