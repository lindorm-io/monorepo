import { isBuffer, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CoseSignError } from "../errors";
import { ICwsKit } from "../interfaces";
import {
  CwsContent,
  CwsKitOptions,
  DecodedCws,
  ParsedCws,
  ParsedCwsHeader,
  SignCwsOptions,
  SignedCws,
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

export class CwsKit implements ICwsKit {
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: CwsKitOptions) {
    this.logger = options.logger.child(["CoseSignKit"]);
    this.kryptos = options.kryptos;
  }

  public sign(data: CwsContent, options: SignCwsOptions = {}): SignedCws {
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
        ...(options.header ?? {}),
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

  public verify<T extends CwsContent>(token: CwsContent): ParsedCws<T> {
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

    const decoded: DecodedCws<T> = {
      protected: protectedDict as any,
      unprotected: unprotectedDict as any,
      payload: payloadBuffer,
      signature: signature,
    };

    const header = parseTokenHeader<ParsedCwsHeader>({
      ...protectedDict,
      ...unprotectedDict,
    } as any);

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (header.critical?.length) {
      for (const param of header.critical) {
        throw new CoseSignError(`Unsupported critical header parameter: ${param}`);
      }
    }

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

  public static isCws(token: Buffer | string): boolean {
    try {
      const decode = CwsKit.decode(token);
      return decode.protected.typ === "application/cose; cose-type=cose-sign";
    } catch {
      return false;
    }
  }

  public static decode<T extends CwsContent>(token: CwsContent): DecodedCws<T> {
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

  public static parse<T extends CwsContent>(token: CwsContent): ParsedCws<T> {
    const decoded = CwsKit.decode<T>(token);

    return {
      decoded,
      header: parseTokenHeader({ ...decoded.protected, ...decoded.unprotected } as any),
      payload: decoded.payload,
      token: isBuffer(token) ? token.toString("base64url") : token,
    };
  }
}
