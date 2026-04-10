import { expires } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CwtError } from "../errors";
import { ICwtKit } from "../interfaces";
import {
  CwtKitOptions,
  DecodedCwt,
  ParsedCwt,
  ParsedCwtPayload,
  SignCwtContent,
  SignCwtOptions,
  SignedCwt,
  ValidateCwtOptions,
  VerifyCwtOptions,
} from "../types";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "#internal/utils/compute-typ-header";
import { decodeCoseClaims, mapCoseClaims } from "#internal/utils/cose/claims";
import { decodeCoseHeader, mapCoseHeader } from "#internal/utils/cose/header";
import { createCoseSignToken } from "#internal/utils/cose-sign-token";
import { createCoseSignature, verifyCoseSignature } from "#internal/utils/cose-signature";
import { createJwtValidate } from "#internal/utils/jwt-validate";
import { mapJwtContentToClaims, parseTokenPayload } from "#internal/utils/jwt-payload";
import { createJwtVerify } from "#internal/utils/jwt-verify";
import { mapTokenHeader, parseTokenHeader } from "#internal/utils/token-header";
import { validate } from "#internal/utils/validate";

export class CwtKit implements ICwtKit {
  private readonly clockTolerance: number;
  private readonly issuer: string | null;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: CwtKitOptions) {
    this.logger = options.logger.child(["CwtKit"]);
    this.kryptos = options.kryptos;
    this.issuer = options.issuer ?? null;

    this.clockTolerance = options.clockTolerance ?? 0;
  }

  public sign<C extends Dict = Dict>(
    content: SignCwtContent<C>,
    options: SignCwtOptions = {},
  ): SignedCwt {
    this.logger.debug("Signing token", { content, options });

    if (!this.issuer) {
      throw new CwtError("Issuer is required to sign CWT");
    }

    const objectId = options.objectId;
    const target = options.target ?? "internal";

    const protectedDict = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.kryptos.algorithm,
        contentType: "application/json",
        headerType: computeTypHeader(content.tokenType, "cwt"),
      }),
      target,
    );
    const protectedCbor = encode(protectedDict);

    const unprotectedDict = mapCoseHeader(
      mapTokenHeader({
        ...(options.header ?? {}),
        keyId: this.kryptos.id,
        objectId,
      }),
      target,
    );

    const claims = mapJwtContentToClaims(
      { algorithm: this.kryptos.algorithm, issuer: this.issuer },
      content,
      { tokenId: randomBytes(20).toString("base64url"), ...options },
    );
    const payloadDict = mapCoseClaims({ ...claims, ...(content.claims ?? {}) }, target);
    const payloadCbor = encode(payloadDict);

    const signature = createCoseSignature({
      kryptos: this.kryptos,
      payload: payloadCbor,
      protectedHeader: protectedCbor,
    });

    const buffer = createCoseSignToken({
      payload: payloadCbor,
      protectedHeader: protectedCbor,
      unprotectedHeader: unprotectedDict,
      signature,
    });
    const token = buffer.toString("base64url");

    const { expiresAt, expiresIn, expiresOn } = expires(content.expires);

    this.logger.debug("Token signed", { token });

    return {
      buffer,
      expiresAt,
      expiresIn,
      expiresOn,
      objectId,
      token,
      tokenId: claims.jti!,
    };
  }

  public verify<C extends Dict = Dict>(
    token: Buffer | string,
    verify: VerifyCwtOptions = {},
  ): ParsedCwt<C> {
    this.logger.debug("Verifying token", { token, verify });

    const [protectedCbor, unprotectedCose, payloadCbor, signature] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );
    const protectedDict = decodeCoseHeader(decode(protectedCbor));
    const unprotectedDict = decodeCoseHeader(unprotectedCose);
    const payloadDict = decodeCoseClaims<C>(decode(payloadCbor));

    if (this.kryptos.algorithm !== protectedDict.alg) {
      throw new CwtError("Invalid token", {
        data: { algorithm: protectedDict.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    if (verify.tokenType !== undefined) {
      const expectedTyp = computeTypHeader(verify.tokenType, "cwt");
      if (protectedDict.typ !== expectedTyp) {
        throw new CwtError("Invalid token", {
          data: { typ: protectedDict.typ },
          debug: { expected: expectedTyp },
        });
      }
    }

    const verified = verifyCoseSignature({
      kryptos: this.kryptos,
      payload: payloadCbor,
      protectedHeader: protectedCbor,
      signature,
    });

    if (!verified) {
      throw new CwtError("Invalid token", {
        data: { verified, token },
      });
    }

    const predicate = createJwtVerify(
      this.kryptos.algorithm,
      verify,
      this.clockTolerance,
    );

    const withDates = {
      ...payloadDict,
      exp: payloadDict.exp ? new Date(payloadDict.exp * 1000) : undefined,
      iat: payloadDict.iat ? new Date(payloadDict.iat * 1000) : undefined,
      nbf: payloadDict.nbf ? new Date(payloadDict.nbf * 1000) : undefined,
      auth_time: payloadDict.auth_time
        ? new Date(payloadDict.auth_time * 1000)
        : undefined,
    };

    try {
      validate(withDates, predicate);
    } catch (err) {
      throw new CwtError("Invalid token", { data: (err as any).data });
    }

    const decoded: DecodedCwt<C> = {
      protected: protectedDict as any,
      unprotected: unprotectedDict as any,
      payload: payloadDict as any,
      signature: signature,
    };

    const payload = parseTokenPayload(payloadDict);
    payload.tokenType = decodeTokenTypeFromTyp(protectedDict.typ, "cwt");

    this.logger.debug("Token verified");

    return {
      decoded,
      header: parseTokenHeader({
        ...protectedDict,
        ...unprotectedDict,
      } as any),
      payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }

  // public static

  public static isCwt(token: Buffer | string): boolean {
    try {
      const decode = CwtKit.decode(token);
      const typ = decode.protected.typ;
      return (
        typ === "application/cwt" || (typeof typ === "string" && typ.endsWith("+cwt"))
      );
    } catch {
      return false;
    }
  }

  public static decode<C extends Dict = Dict>(token: Buffer | string): DecodedCwt<C> {
    const [protectedCbor, unprotectedHeader, payloadCbor, signature] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );
    const protectedCose = decode(protectedCbor);
    const payloadCose = decode(payloadCbor);

    return {
      protected: decodeCoseHeader(protectedCose) as any,
      unprotected: decodeCoseHeader(unprotectedHeader) as any,
      payload: decodeCoseClaims(payloadCose),
      signature: signature.toString("base64url"),
    };
  }

  public static parse<C extends Dict = Dict>(token: Buffer | string): ParsedCwt<C> {
    const decoded = CwtKit.decode<C>(token);

    const payload = parseTokenPayload(decoded.payload);
    payload.tokenType = decodeTokenTypeFromTyp(decoded.protected.typ, "cwt");

    return {
      decoded,
      header: parseTokenHeader({ ...decoded.protected, ...decoded.unprotected }),
      payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }

  public static validate<C extends Dict = Dict>(
    payload: ParsedCwtPayload<C>,
    options: ValidateCwtOptions,
  ): void {
    const operators = createJwtValidate(options);

    validate(payload, operators);
  }
}
