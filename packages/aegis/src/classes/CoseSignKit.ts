import { isBuffer, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CoseSignError } from "../errors/CoseSignError";
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

  public sign<T extends CoseSignContent>(
    data: T,
    options: SignCoseSignOptions = {},
  ): SignedCoseSign {
    const objectId = options.objectId ?? randomBytes(20).toString("base64url");

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

    this.logger.silly("Token headers created", {
      protectedHeader,
      unprotectedHeader,
    });

    const payloadBuffer = isBuffer(data) ? data : Buffer.from(data, "utf-8");
    const payloadCbor = encode(payloadBuffer);

    this.logger.silly("Token payload encoded", { options });

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

    return { buffer, objectId, token };
  }

  public verify<T extends CoseSignContent>(token: Buffer | string): ParsedCoseSign<T> {
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

    this.logger.silly("Token signature verified", { verified, token: token });

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

    return {
      decoded,
      header,
      payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }

  // public static

  public static decode<T extends CoseSignContent>(
    token: Buffer | string,
  ): DecodedCoseSign<T> {
    const [protectedCbor, unprotectedHeader, payloadCbor, signature] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );
    const protectedCose = decode(protectedCbor);
    const protectedDict = decodeCoseHeader(protectedCose);

    const payloadBuffer = decode(payloadCbor);

    const payload =
      protectedDict.cty === "text/plain; charset=utf-8"
        ? (payloadBuffer.toString("utf-8") as T)
        : payloadBuffer;

    return {
      protected: protectedDict as any,
      unprotected: decodeCoseHeader(unprotectedHeader) as any,
      payload,
      signature: signature.toString("base64url"),
    };
  }

  public static parse<T extends CoseSignContent>(
    token: Buffer | string,
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
