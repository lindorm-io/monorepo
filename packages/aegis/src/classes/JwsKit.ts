import { B64 } from "@lindorm/b64";
import { isBuffer, isJws, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { B64U } from "../constants/private";
import { JwsError } from "../errors";
import { IJwsKit } from "../interfaces";
import {
  DecodedJws,
  JwsKitOptions,
  ParsedJws,
  ParsedJwsHeader,
  SignJwsOptions,
  SignedJws,
  TokenHeaderOptions,
} from "../types";
import {
  createJoseSignature,
  decodeJoseHeader,
  encodeJoseHeader,
  parseTokenHeader,
  verifyJoseSignature,
} from "../utils/private";

export class JwsKit implements IJwsKit {
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: JwsKitOptions) {
    this.logger = options.logger.child(["JwsKit"]);
    this.kryptos = options.kryptos;
  }

  public sign<T extends Buffer | string>(
    data: T,
    options: SignJwsOptions = {},
  ): SignedJws {
    this.logger.debug("Signing token", { options });

    const objectId = options.objectId ?? randomUUID();

    const headerOptions: TokenHeaderOptions = {
      ...(options.header ?? {}),
      algorithm: this.kryptos.algorithm,
      contentType: options.contentType
        ? options.contentType
        : isString(data)
          ? "text/plain; charset=utf-8"
          : "application/octet-stream",
      headerType: "JWS",
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
    };

    const header = encodeJoseHeader(headerOptions);

    const payload = isBuffer(data) ? data.toString(B64U) : B64.encode(data, B64U);

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token });

    return { objectId, token };
  }

  public verify<T extends Buffer | string>(token: string): ParsedJws<T> {
    this.logger.debug("Verifying token", { token });

    const parsed = JwsKit.parse<T>(token);

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwsError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwsError("Invalid token", {
        data: { verified, token: token },
      });
    }

    this.logger.debug("Token verified");

    return parsed;
  }

  // public static

  public static isJws(jws: string): boolean {
    return isJws(jws);
  }

  public static decode(jws: string): DecodedJws {
    const [header, payload, signature] = jws.split(".");
    const decodedHeader = decodeJoseHeader(header);

    return {
      header: decodedHeader,
      payload:
        decodedHeader.cty === "text/plain; charset=utf-8"
          ? B64.toString(payload)
          : payload,
      signature,
    };
  }

  public static parse<T extends Buffer | string>(token: string): ParsedJws<T> {
    const decoded = JwsKit.decode(token);

    if (
      decoded.header.typ !== undefined &&
      decoded.header.typ !== "JWS" &&
      decoded.header.typ !== "JOSE"
    ) {
      throw new JwsError("Invalid token", {
        data: { typ: decoded.header.typ },
        details: "Header type must be JWS, JOSE, or undefined",
      });
    }

    const header = parseTokenHeader<ParsedJwsHeader>(decoded.header);

    const payload =
      header.contentType === "text/plain; charset=utf-8"
        ? (decoded.payload as T)
        : (B64.toBuffer(decoded.payload, B64U) as T);

    return { decoded, header, payload, token };
  }
}
