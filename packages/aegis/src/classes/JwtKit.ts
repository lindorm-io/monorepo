import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { JwtError } from "../errors";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "#internal/utils/compute-typ-header";
import { IJwtKit } from "../interfaces";
import {
  DecodedJwt,
  JwtKitOptions,
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
import { decodeJoseHeader, encodeJoseHeader } from "#internal/utils/jose-header";
import { createJoseSignature, verifyJoseSignature } from "#internal/utils/jose-signature";
import { createJwtValidate } from "#internal/utils/jwt-validate";
import {
  decodeJwtPayload,
  encodeJwtPayload,
  parseTokenPayload,
} from "#internal/utils/jwt-payload";
import { createJwtVerify } from "#internal/utils/jwt-verify";
import { parseTokenHeader } from "#internal/utils/token-header";
import { validate } from "#internal/utils/validate";

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
      headerType: computeTypHeader(content.tokenType, "jwt"),
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

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (parsed.header.critical?.length) {
      for (const param of parsed.header.critical) {
        throw new JwtError(`Unsupported critical header parameter: ${param}`);
      }
    }

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwtError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    if (verify.tokenType !== undefined) {
      const expectedTyp = computeTypHeader(verify.tokenType, "jwt");
      if (parsed.decoded.header.typ !== expectedTyp) {
        throw new JwtError("Invalid token", {
          data: { typ: parsed.decoded.header.typ },
          debug: { expected: expectedTyp },
        });
      }
    }

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwtError("Invalid token", {
        data: { verified, token: token },
      });
    }

    const predicate = createJwtVerify(
      this.kryptos.algorithm,
      verify,
      this.clockTolerance,
    );

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

    try {
      validate(withDates, predicate);
    } catch (err) {
      throw new JwtError("Invalid token", { data: (err as any).data });
    }

    this.logger.debug("Token verified");

    return parsed;
  }

  // public static

  public static isJwt(jwt: string): boolean {
    if (typeof jwt !== "string") return false;
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    try {
      const header = decodeJoseHeader(parts[0]);
      if (typeof header.alg !== "string") return false;
      const typ = header.typ;
      return typ === "JWT" || (typeof typ === "string" && typ.endsWith("+jwt"));
    } catch {
      return false;
    }
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

    const typ = decoded.header.typ;
    if (typ !== "JWT" && !(typeof typ === "string" && typ.endsWith("+jwt"))) {
      throw new JwtError("Invalid token", {
        data: { typ },
        details: "Header type must be JWT or <type>+jwt",
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
    payload.tokenType = decodeTokenTypeFromTyp(typ, "jwt");

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
