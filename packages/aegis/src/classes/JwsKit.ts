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
  TokenHeaderSignOptions,
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
    const objectId = options.objectId ?? randomUUID();

    const headerOptions: TokenHeaderSignOptions = {
      algorithm: this.kryptos.algorithm,
      contentType: options.contentType
        ? options.contentType
        : isString(data)
          ? "text/plain; charset=utf-8"
          : "application/octet-stream",
      headerType: "JWS",
      jwksUri: this.kryptos.jwksUri,
      keyId: this.kryptos.id,
      objectId,
    };

    const header = encodeJoseHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    const payload = isBuffer(data) ? data.toString(B64U) : B64.encode(data, B64U);

    this.logger.silly("Token payload encoded", { payload, options });

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    this.logger.silly("Token signature created", { signature });

    const token = `${header}.${payload}.${signature}`;

    this.logger.silly("Token signed", {
      keyId: this.kryptos.id,
      objectId,
      token,
    });

    return { objectId, token };
  }

  public verify<T extends Buffer | string>(jws: string): ParsedJws<T> {
    const parsed = JwsKit.parse<T>(jws);

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwsError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyJoseSignature(this.kryptos, jws);

    this.logger.silly("Token signature verified", { verified, token: jws });

    if (!verified) {
      throw new JwsError("Invalid token", {
        data: { verified, token: jws },
      });
    }

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

    if (decoded.header.typ !== "JWS") {
      throw new JwsError("Invalid token", {
        data: { typ: decoded.header.typ },
        details: "Header type must be JWS",
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
