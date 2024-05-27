import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { B64U } from "../constants/private/format";
import { JwsError } from "../errors";
import {
  DecodedJws,
  IJwsKit,
  JwsKitOptions,
  SignJwsOptions,
  SignedJws,
  TokenHeaderSignOptions,
  VerifiedJws,
  VerifiedJwsHeader,
} from "../types";
import { createTokenSignature } from "../utils/private/create-token-signature";
import {
  decodeTokenHeader,
  encodeTokenHeader,
  parseTokenHeader,
} from "../utils/private/token-header";
import { verifyTokenSignature } from "../utils/private/verify-token-signature";

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

  public verify<T extends Buffer | string>(jws: string): VerifiedJws<T> {
    const decoded = JwsKit.decode(jws);

    if (decoded.header.typ !== "JWS") {
      throw new JwsError("Invalid token", {
        data: { typ: decoded.header.typ },
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JwsError("Invalid token", {
        data: { alg: decoded.header.alg },
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

    const header = parseTokenHeader<VerifiedJwsHeader>(decoded.header);

    const payload =
      header.contentType === "text/plain"
        ? decoded.payload
        : B64.toBuffer(decoded.payload, B64U);

    this.logger.silly("Token verified", { header, payload });

    return {
      decoded,
      header,
      payload: payload as T,
      token: jws,
    };
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
}
