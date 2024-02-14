import { Encryption, EncryptionKeyAlgorithm } from "@lindorm-io/aes";
import { Logger } from "@lindorm-io/core-logger";
import { KeySetType } from "@lindorm-io/jwk";
import { Keystore } from "@lindorm-io/keystore";
import { JweOptions } from "../types";
import { decryptJwe, encryptJwe, sanitiseToken } from "../util/public";

export class JWE {
  private readonly encryption: Encryption;
  private readonly encryptionKeyAlgorithm: EncryptionKeyAlgorithm;
  private readonly keystore: Keystore;
  private readonly keyType: KeySetType | undefined;
  private readonly logger: Logger;

  public constructor(options: JweOptions, keystore: Keystore, logger: Logger) {
    this.logger = logger.createChildLogger(["JWE"]);

    this.encryption = options.encryption || "aes-256-gcm";
    this.encryptionKeyAlgorithm = options.encryptionKeyAlgorithm || "RSA-OAEP-256";
    this.keystore = keystore;
    this.keyType = options.keyType;
  }

  public encrypt(token: string): string {
    this.logger.debug("Encrypting token", {
      encryption: this.encryption,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      token: sanitiseToken(token),
    });

    const key = this.keystore.findKey("enc", this.keyType);

    const encrypted = encryptJwe({
      encryption: this.encryption,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      keySet: key.keySet,
      token,
    });

    this.logger.debug("Successfully encrypted token", { token: sanitiseToken(encrypted) });

    return encrypted;
  }

  public decrypt(jwe: string): string {
    this.logger.debug("Decrypting token", { token: sanitiseToken(jwe) });

    const key = this.keystore.findKey("enc", this.keyType);

    const decrypted = decryptJwe({
      jwe,
      keySet: key.keySet,
    });

    this.logger.debug("Successfully decrypted token", { token: sanitiseToken(decrypted) });

    return decrypted;
  }
}
