import { Encryption, EncryptionKeyAlgorithm, KeyObject } from "@lindorm-io/aes";
import { Logger } from "@lindorm-io/core-logger";
import { KeySet } from "@lindorm-io/jwk";
import { JweOptions } from "../types";
import { decryptJwe, encryptJwe, sanitiseToken } from "../util/public";

export class JWE {
  private readonly encryption: Encryption;
  private readonly encryptionKeyAlgorithm: EncryptionKeyAlgorithm;
  private readonly key: KeyObject | undefined;
  private readonly keySet: KeySet | undefined;
  private readonly logger: Logger;

  public constructor(options: JweOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["JWE"]);

    this.encryption = options.encryption || "aes-256-gcm";
    this.encryptionKeyAlgorithm = options.encryptionKeyAlgorithm || "RSA-OAEP-256";
    this.key = options.key;
    this.keySet = options.keySet;
  }

  public encrypt(token: string): string {
    this.logger.debug("Encrypting token", {
      encryption: this.encryption,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      token: sanitiseToken(token),
    });

    const encrypted = encryptJwe({
      encryption: this.encryption,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      key: this.key,
      keySet: this.keySet,
      token,
    });

    this.logger.debug("Successfully encrypted token", { token: sanitiseToken(encrypted) });

    return encrypted;
  }

  public decrypt(jwe: string): string {
    this.logger.debug("Decrypting token", { token: sanitiseToken(jwe) });

    const decrypted = decryptJwe({
      jwe,
      key: this.key,
      keySet: this.keySet,
    });

    this.logger.debug("Successfully decrypted token", { token: sanitiseToken(decrypted) });

    return decrypted;
  }
}
