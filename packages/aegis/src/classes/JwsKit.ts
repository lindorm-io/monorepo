import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
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
  createTokenSignature,
  decodeTokenHeader,
  encodeTokenHeader,
  parseTokenHeader,
  verifyTokenSignature,
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
    const algorithm = this.kryptos.algorithm;
    const jwksUri = this.kryptos.jwksUri;
    const keyId = this.kryptos.id;
    const objectId = options.objectId ?? randomUUID();
    const contentType = options.contentType
      ? options.contentType
      : isString(data)
        ? "text/plain"
        : "application/buffer";

    const headerOptions: TokenHeaderSignOptions = {
      algorithm,
      contentType,
      headerType: "JWS",
      jwksUri,
      keyId,
      objectId,
    };

    const header = encodeTokenHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    const payload = isBuffer(data) ? data.toString(B64U) : B64.encode(data, B64U);

    this.logger.silly("Token payload encoded", { payload, options });

    const signature = createTokenSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    this.logger.silly("Token signature created", { signature });

    const token = `${header}.${payload}.${signature}`;

    this.logger.silly("Token signed", {
      keyId,
      objectId,
      token,
    });

    return { objectId, token };
  }

  public verify<T extends Buffer | string>(jws: string): ParsedJws<T> {
    const decoded = JwsKit.parse<T>(jws);

    if (this.kryptos.algorithm !== decoded.header.algorithm) {
      throw new JwsError("Invalid token", {
        data: { algorithm: decoded.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyTokenSignature(this.kryptos, jws);

    this.logger.silly("Token signature verified", { verified, token: jws });

    if (!verified) {
      throw new JwsError("Invalid token", {
        data: { verified, token: jws },
      });
    }

    return decoded;
  }

  // public static

  public static decode(jws: string): DecodedJws {
    const [header, payload, signature] = jws.split(".");
    const decodedHeader = decodeTokenHeader(header);

    return {
      header: decodedHeader,
      payload: decodedHeader.cty === "text/plain" ? B64.toString(payload) : payload,
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
      header.contentType === "text/plain"
        ? (decoded.payload as T)
        : (B64.toBuffer(decoded.payload, B64U) as T);

    return { decoded, header, payload, token };
  }

  public static isJws(jws: string): boolean {
    if (!jws.includes(".")) return false;
    if (!jws.startsWith("eyJ")) return false;

    const [header] = jws.split(".");
    const decoded = decodeTokenHeader(header);

    return decoded.typ === "JWS";
  }
}
