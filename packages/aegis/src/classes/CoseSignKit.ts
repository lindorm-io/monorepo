import { isBuffer, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CoseSignError } from "../errors";
import { ICoseSignKit } from "../interfaces";
import {
  CoseSignContent,
  CoseSignKitOptions,
  DecodedCoseSign,
  ParsedCoseSign,
  ParsedCoseSignHeader,
  SignCoseSignOptions,
  SignedCoseSign,
} from "../types";
import {
  createCoseSignToken,
  createCoseSignature,
  decodeCoseHeader,
  mapCoseHeader,
  mapTokenHeader,
  parseTokenHeader,
  verifyCoseSignature,
} from "../utils/private";

export class CoseSignKit implements ICoseSignKit {
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: CoseSignKitOptions) {
    this.logger = options.logger.child(["CoseSignKit"]);
    this.kryptos = options.kryptos;
  }

  public sign(data: CoseSignContent, options: SignCoseSignOptions = {}): SignedCoseSign {
    const objectId = options.objectId ?? randomBytes(20).toString("base64url");

    this.logger.debug("Signing token", { options });

    const protectedHeader = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.kryptos.algorithm,
        contentType: options.contentType
          ? options.contentType
          : isString(data)
            ? "text/plain; charset=utf-8"
            : "application/octet-stream",
        headerType: "application/cose; cose-type=cose-sign",
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

    const payloadBuffer = isBuffer(data) ? data : Buffer.from(data, "utf-8");
    const payloadCbor = encode(payloadBuffer);

    const signature = createCoseSignature({
      kryptos: this.kryptos,
      payload: payloadCbor,
      protectedHeader: protectedCbor,
    });

    const buffer = createCoseSignToken({
      payload: payloadCbor,
      protectedHeader: protectedCbor,
      unprotectedHeader,
      signature,
    });
    const token = buffer.toString("base64url");

    this.logger.debug("Token signed", { token });

    return { buffer, objectId, token };
  }

  public verify<T extends CoseSignContent>(token: CoseSignContent): ParsedCoseSign<T> {
    this.logger.debug("Verifying token", { token });

    const [protectedCbor, unprotectedCose, payloadCbor, signature] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );
    const protectedDict = decodeCoseHeader(decode(protectedCbor));

    if (this.kryptos.algorithm !== protectedDict.alg) {
      throw new CoseSignError("Invalid token", {
        data: { algorithm: protectedDict.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyCoseSignature({
      kryptos: this.kryptos,
      payload: payloadCbor,
      protectedHeader: protectedCbor,
      signature,
    });

    if (!verified) {
      throw new CoseSignError("Invalid token", {
        data: { verified, token },
      });
    }

    const unprotectedDict = decodeCoseHeader(unprotectedCose);
    const payloadBuffer = decode(payloadCbor);

    const decoded: DecodedCoseSign<T> = {
      protected: protectedDict as any,
      unprotected: unprotectedDict as any,
      payload: payloadBuffer as any,
      signature: signature,
    };

    const header = parseTokenHeader<ParsedCoseSignHeader>({
      ...protectedDict,
      ...unprotectedDict,
    } as any);

    const payload =
      header.contentType === "text/plain; charset=utf-8"
        ? (payloadBuffer.toString("utf-8") as T)
        : payloadBuffer;

    this.logger.debug("Token verified");

    return {
      decoded,
      header,
      payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }

  // public static

  public static isCoseSign(token: Buffer | string): boolean {
    try {
      const decode = CoseSignKit.decode(token);
      return decode.protected.typ === "application/cose; cose-type=cose-sign";
    } catch {
      return false;
    }
  }

  public static decode<T extends CoseSignContent>(
    token: CoseSignContent,
  ): DecodedCoseSign<T> {
    const [protectedCbor, unprotectedHeader, payloadCbor, signature] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );

    const protectedDict = decodeCoseHeader(decode(protectedCbor));
    const unprotectedDict = decodeCoseHeader(unprotectedHeader);

    const payloadBuffer = decode(payloadCbor);
    const payload =
      protectedDict.cty === "text/plain; charset=utf-8"
        ? (payloadBuffer.toString("utf-8") as T)
        : payloadBuffer;

    return {
      protected: protectedDict as any,
      unprotected: unprotectedDict as any,
      payload,
      signature: signature.toString("base64url"),
    };
  }

  public static parse<T extends CoseSignContent>(
    token: CoseSignContent,
  ): ParsedCoseSign<T> {
    const decoded = CoseSignKit.decode<T>(token);

    return {
      decoded,
      header: parseTokenHeader({ ...decoded.protected, ...decoded.unprotected } as any),
      payload: decoded.payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }
}
