import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { B64U } from "../constants/private";
import { JweError } from "../errors";
import { IJweKit } from "../interfaces";
import {
  DecodedJwe,
  DecryptedJwe,
  DecryptedJweHeader,
  EncryptedJwe,
  JweEncryptOptions,
  JweKitOptions,
  TokenHeaderSignOptions,
} from "../types";
import { decodeTokenHeader, encodeTokenHeader, parseTokenHeader } from "../utils/private";

export class JweKit implements IJweKit {
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;
  private readonly kryptosMayOverrideEncryption: boolean;

  public constructor(options: JweKitOptions) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;

    this.encryption = options.encryption = "A256GCM";
    this.kryptosMayOverrideEncryption = options.kryptosMayOverrideEncryption ?? false;
  }

  public encrypt(data: string, options: JweEncryptOptions = {}): EncryptedJwe {
    const encryption =
      this.kryptosMayOverrideEncryption && this.kryptos.encryption
        ? this.kryptos.encryption
        : this.encryption;

    const jwksUri = this.kryptos.jwksUri;
    const keyId = this.kryptos.id;
    const objectId = options.objectId ?? randomUUID();

    const critical: Array<Exclude<keyof TokenHeaderSignOptions, "critical">> = [
      "algorithm",
      "encryption",
    ];

    const aes = new AesKit({ encryption, kryptos: this.kryptos });

    const {
      authTag,
      content,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    } = aes.encrypt(data, "record");

    if (publicEncryptionJwk) critical.push("publicEncryptionJwk");
    if (publicEncryptionIv) critical.push("publicEncryptionIv");
    if (publicEncryptionTag) critical.push("publicEncryptionTag");
    if (hkdfSalt) critical.push("hkdfSalt");
    if (pbkdfIterations) critical.push("pbkdfIterations");
    if (pbkdfSalt) critical.push("pbkdfSalt");

    const headerOptions: TokenHeaderSignOptions = {
      algorithm: this.kryptos.algorithm,
      contentType: this.contentType(data),
      critical,
      encryption,
      headerType: "JWE",
      hkdfSalt,
      jwksUri,
      keyId,
      objectId,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionTag,
    };

    const header = encodeTokenHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    const token = removeUndefined([
      header,
      publicEncryptionKey ? B64.encode(publicEncryptionKey, B64U) : "",
      B64.encode(initialisationVector, B64U),
      B64.encode(content, B64U),
      authTag ? B64.encode(authTag, B64U) : undefined,
    ]).join(".");

    this.logger.silly("Token created", { keyId, token });

    return { token };
  }

  public decrypt(token: string): DecryptedJwe {
    const encryption =
      this.kryptosMayOverrideEncryption && this.kryptos.encryption
        ? this.kryptos.encryption
        : this.encryption;

    const raw = JweKit.decode(token);

    if (raw.header.typ !== "JWE") {
      throw new JweError("Invalid token", {
        data: { typ: raw.header.typ },
      });
    }

    if (this.kryptos.algorithm !== raw.header.alg) {
      throw new JweError("Invalid token", {
        data: { alg: raw.header.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const header = parseTokenHeader<DecryptedJweHeader>(raw.header);

    const authTag = raw.authTag ? B64.toBuffer(raw.authTag) : undefined;
    const content = B64.toBuffer(raw.content);
    const hkdfSalt = header.hkdfSalt ? B64.toBuffer(header.hkdfSalt, B64U) : undefined;
    const initialisationVector = B64.toBuffer(raw.initialisationVector);
    const pbkdfIterations = header.pbkdfIterations;
    const pbkdfSalt = header.pbkdfSalt ? B64.toBuffer(header.pbkdfSalt, B64U) : undefined;
    const publicEncryptionIv = header.publicEncryptionIv
      ? B64.toBuffer(header.publicEncryptionIv)
      : undefined;
    const publicEncryptionKey = raw.publicEncryptionKey
      ? B64.toBuffer(raw.publicEncryptionKey)
      : undefined;
    const publicEncryptionJwk = header.publicEncryptionJwk;
    const publicEncryptionTag = header.publicEncryptionTag
      ? B64.toBuffer(header.publicEncryptionTag)
      : undefined;

    if (header.critical.includes("publicEncryptionJwk") && !publicEncryptionJwk) {
      throw new JweError("Missing public encryption JWK");
    }
    if (header.critical.includes("publicEncryptionIv") && !publicEncryptionIv) {
      throw new JweError("Missing public encryption iv");
    }
    if (header.critical.includes("publicEncryptionTag") && !publicEncryptionTag) {
      throw new JweError("Missing public encryption tag");
    }
    if (header.critical.includes("hkdfSalt") && !hkdfSalt) {
      throw new JweError("Missing salt");
    }
    if (header.critical.includes("pbkdfIterations") && !pbkdfIterations) {
      throw new JweError("Missing iterations");
    }
    if (header.critical.includes("pbkdfSalt") && !pbkdfSalt) {
      throw new JweError("Missing salt");
    }

    const aes = new AesKit({ encryption, kryptos: this.kryptos });

    const payload = aes.decrypt({
      authTag,
      content,
      encryption,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    });

    this.logger.silly("Token decrypted", { payload });

    return { header, payload, decoded: raw, token };
  }

  // public static

  public static decode(jwe: string): DecodedJwe {
    const [header, publicEncryptionKey, initialisationVector, content, authTag] =
      jwe.split(".");

    return {
      header: decodeTokenHeader(header),
      publicEncryptionKey: publicEncryptionKey?.length ? publicEncryptionKey : undefined,
      initialisationVector,
      content,
      authTag: authTag?.length ? authTag : undefined,
    };
  }

  public static isJwe(jwe: string): boolean {
    if (!jwe.includes(".")) return false;
    if (!jwe.startsWith("eyJ")) return false;

    const [header] = jwe.split(".");
    const decoded = decodeTokenHeader(header);

    return decoded.typ === "JWE";
  }

  // private

  private contentType(input: string): string {
    if (isString(input) && input.startsWith("{") && input.endsWith("}")) {
      return "application/json";
    }

    if (isString(input) && input.startsWith("[") && input.endsWith("]")) {
      return "application/json";
    }

    if (!input.startsWith("eyJ") && !input.includes(".")) {
      return "text/plain";
    }

    try {
      const [header] = input.split(".");

      return decodeTokenHeader(header).typ;
    } catch (err) {
      this.logger.silly("Failed to decode content type", { err });
    }

    if (isString(input)) {
      return "text/plain";
    }

    return "application/unknown";
  }
}
