import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { JweError } from "../errors";
import {
  DecodedJwe,
  DecryptedJwe,
  DecryptedJweHeader,
  EncryptedJwe,
  IJweKit,
  JweEncryptOptions,
  JweKitOptions,
  TokenHeaderSignOptions,
} from "../types";
import {
  _decodeTokenHeader,
  _encodeTokenHeader,
  _parseTokenHeader,
} from "../utils/private/token-header";

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

    const aes = new AesKit({
      encryption,
      format: "base64url",
      kryptos: this.kryptos,
    });

    const {
      authTag,
      content,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionJwk,
      publicEncryptionKey,
    } = aes.encrypt(data, "object");

    const jwksUri = this.kryptos.jwksUri;
    const keyId = this.kryptos.id;
    const objectId = options.objectId ?? randomUUID();

    const critical: Array<Exclude<keyof TokenHeaderSignOptions, "critical">> = [
      "algorithm",
      "encryption",
    ];

    if (publicEncryptionJwk) critical.push("publicEncryptionJwk");
    if (hkdfSalt) critical.push("hkdfSalt");
    if (pbkdfIterations) critical.push("pbkdfIterations");
    if (pbkdfSalt) critical.push("pbkdfSalt");

    const headerOptions: TokenHeaderSignOptions = {
      algorithm: this.kryptos.algorithm,
      contentType: this.contentType(data),
      critical,
      encryption,
      headerType: "JWE",
      hkdfSalt: hkdfSalt ? B64.encode(hkdfSalt, "base64url") : undefined,
      jwksUri,
      keyId,
      objectId,
      pbkdfIterations,
      pbkdfSalt: pbkdfSalt ? B64.encode(pbkdfSalt, "base64url") : undefined,
      publicEncryptionJwk,
    };

    const header = _encodeTokenHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    const token = removeUndefined([
      header,
      publicEncryptionKey ? B64.encode(publicEncryptionKey, "base64url") : "",
      B64.encode(initialisationVector, "base64url"),
      B64.encode(content, "base64url"),
      authTag ? B64.encode(authTag, "base64url") : undefined,
    ]).join(".");

    this.logger.silly("Token created", { keyId, token });

    return { token };
  }

  public decrypt(jwe: string): DecryptedJwe {
    const encryption =
      this.kryptosMayOverrideEncryption && this.kryptos.encryption
        ? this.kryptos.encryption
        : this.encryption;

    const decoded = JweKit.decode(jwe);

    if (decoded.header.typ !== "JWE") {
      throw new JweError("Invalid token", {
        data: { typ: decoded.header.typ },
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JweError("Invalid token", {
        data: { alg: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const header = _parseTokenHeader<DecryptedJweHeader>(decoded.header);

    const aes = new AesKit({
      encryption,
      format: "base64url",
      kryptos: this.kryptos,
    });

    const authTag = decoded.authTag ? B64.toBuffer(decoded.authTag) : undefined;
    const content = B64.toBuffer(decoded.content);
    const hkdfSalt = header.hkdfSalt
      ? B64.toBuffer(header.hkdfSalt, "base64url")
      : undefined;
    const initialisationVector = B64.toBuffer(decoded.initialisationVector);
    const pbkdfIterations = header.pbkdfIterations;
    const pbkdfSalt = header.pbkdfSalt
      ? B64.toBuffer(header.pbkdfSalt, "base64url")
      : undefined;
    const publicEncryptionKey = decoded.publicEncryptionKey
      ? B64.toBuffer(decoded.publicEncryptionKey)
      : undefined;
    const publicEncryptionJwk = header.publicEncryptionJwk;

    if (header.critical.includes("publicEncryptionJwk") && !publicEncryptionJwk) {
      throw new JweError("Missing public encryption JWK");
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

    const payload = aes.decrypt({
      authTag,
      content,
      encryption,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionJwk,
      publicEncryptionKey,
    });

    this.logger.silly("Token decrypted", { payload });

    return { __jwe: decoded, header, payload };
  }

  // public static

  public static decode(jwe: string): DecodedJwe {
    const [header, publicEncryptionKey, initialisationVector, content, authTag] =
      jwe.split(".");

    const result: DecodedJwe = {
      header: _decodeTokenHeader(header),
      publicEncryptionKey: publicEncryptionKey?.length ? publicEncryptionKey : undefined,
      initialisationVector,
      content,
      authTag: authTag?.length ? authTag : undefined,
    };

    return result;
  }

  // private

  private contentType(input: string): string {
    if (!input.startsWith("eyJ") && !input.includes(".")) {
      return "text/plain";
    }

    const [header] = input.split(".");

    return _decodeTokenHeader(header).typ;
  }
}
