import { expires } from "@lindorm/date";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CwtError } from "../errors";
import {
  CwtKitOptions,
  DecodedCwt,
  Operators,
  ParsedCwt,
  ParsedCwtPayload,
  SignCwtContent,
  SignCwtOptions,
  SignedCwt,
  ValidateCwtOptions,
  VerifyCwtOptions,
} from "../types";
import {
  createJwtValidate,
  createJwtVerify,
  decodeCoseClaims,
  decodeCoseHeader,
  mapCoseClaims,
  mapCoseHeader,
  mapJwtContentToClaims,
  mapTokenHeader,
  parseTokenHeader,
  parseTokenPayload,
  validate,
  validateValue,
} from "../utils/private";
import { SignatureKit } from "./SignatureKit";

export class CwtKit {
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
    const kit = new SignatureKit({
      dsa: "ieee-p1363",
      kryptos: this.kryptos,
    });

    if (!this.issuer) {
      throw new Error("Issuer is required to sign CWT");
    }

    const objectId =
      options.objectId ?? content.subject ?? randomBytes(20).toString("base64url");

    const protectedHeader = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.kryptos.algorithm,
        contentType: "application/json",
        headerType: "application/cwt",
      }),
    );
    const protectedCbor = encode(protectedHeader);

    const unprotectedHeader = mapCoseHeader(
      mapTokenHeader({
        jwksUri: this.kryptos.jwksUri,
        keyId: this.kryptos.id,
        objectId,
      }),
    );

    this.logger.silly("Token headers created", {
      protectedHeader,
      unprotectedHeader,
    });

    const claims = mapJwtContentToClaims(
      { algorithm: this.kryptos.algorithm, issuer: this.issuer },
      content,
      { tokenId: randomBytes(20).toString("base64url"), ...options },
    );
    const payload = mapCoseClaims({ ...claims, ...(content.claims ?? {}) });
    const payloadCbor = encode(payload);

    this.logger.silly("Token payload created", { payload, options: content });

    const signatureArray = ["Signature1", protectedCbor, Buffer.alloc(0), payloadCbor];
    const signatureCbor = encode(signatureArray);
    const signature = kit.sign(signatureCbor);

    const tokenArray = [protectedCbor, unprotectedHeader, payloadCbor, signature];
    const token = encode(tokenArray).toString("base64url");

    const { expiresAt, expiresIn, expiresOn } = expires(content.expires);

    return { expiresAt, expiresIn, expiresOn, objectId, token, tokenId: claims.jti! };
  }

  public verify<C extends Dict = Dict>(
    token: string,
    verify: VerifyCwtOptions = {},
  ): ParsedCwt<C> {
    const kit = new SignatureKit({
      dsa: "ieee-p1363",
      kryptos: this.kryptos,
    });

    const [protectedCbor, unprotectedCose, payloadCbor, signature] = decode(
      Buffer.from(token, "base64url"),
    );
    const protectedHeader = decodeCoseHeader(decode(protectedCbor));
    const unprotectedHeader = decodeCoseHeader(unprotectedCose);
    const payload = decodeCoseClaims<C>(decode(payloadCbor));

    if (this.kryptos.algorithm !== protectedHeader.alg) {
      throw new CwtError("Invalid token", {
        data: { algorithm: protectedHeader.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const signatureArray = ["Signature1", protectedCbor, Buffer.alloc(0), payloadCbor];
    const signatureCbor = encode(signatureArray);

    const verified = kit.verify(signatureCbor, signature);

    this.logger.silly("Token signature verified", { verified, token: token });

    if (!verified) {
      throw new CwtError("Invalid token", {
        data: { verified, token },
      });
    }

    const operators = createJwtVerify(
      this.kryptos.algorithm,
      verify,
      this.clockTolerance,
    );

    const invalid: Array<{ key: string; value: any; ops: Operators }> = [];

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
      throw new CwtError("Invalid token", { data: { invalid } });
    }

    const decoded: DecodedCwt<C> = {
      protected: protectedHeader as any,
      unprotected: unprotectedHeader as any,
      payload: payload as any,
      signature: signature,
    };

    return {
      decoded,
      header: parseTokenHeader({
        ...protectedHeader,
        ...unprotectedHeader,
      } as any),
      payload: parseTokenPayload(payload),
      token,
    };
  }

  // public static

  public static decode<C extends Dict = Dict>(token: string): DecodedCwt<C> {
    const [protectedCbor, unprotectedHeader, payloadCbor, signature] = decode(
      Buffer.from(token, "base64url"),
    );
    const protectedHeader = decode(protectedCbor);
    const payloadCose = decode(payloadCbor);

    return {
      protected: decodeCoseHeader(protectedHeader) as any,
      unprotected: decodeCoseHeader(unprotectedHeader) as any,
      payload: decodeCoseClaims(payloadCose) as any,
      signature: signature.toString("base64url"),
    };
  }

  public static parse<C extends Dict = Dict>(token: string): ParsedCwt<C> {
    const decoded = CwtKit.decode<C>(token);

    return {
      decoded,
      header: parseTokenHeader({ ...decoded.protected, ...decoded.unprotected }),
      payload: parseTokenPayload(decoded.payload),
      token,
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
