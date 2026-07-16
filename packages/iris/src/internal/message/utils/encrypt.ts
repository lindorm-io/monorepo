import { IrisEncryptionError } from "../../../errors/IrisEncryptionError.js";
import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError.js";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { MessageEncryptionContext } from "../types/encryption-context.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { mergeEncryptionKey } from "./merge-encryption-key.js";
import { resolveEncryptionKey } from "./resolve-encryption-key.js";

export const encryptPayload = async (
  data: Buffer,
  context: MessageEncryptionContext | null | undefined,
  encrypted: MetaEncrypted,
): Promise<string> => {
  if (!context?.amphora) {
    throw new IrisNotSupportedError(
      "@Encrypted requires an Amphora instance but none was configured",
      {
        code: "missing_amphora_instance",
        title: "Missing Amphora Instance",
        details:
          "A message marked with @Encrypted requires an Amphora instance to encrypt its payload, but none was configured on the source.",
      },
    );
  }

  const amphora = context.amphora;
  const key = mergeEncryptionKey(encrypted, context.key);

  try {
    const { AesKit } = await import("@lindorm/aes");
    const kryptos = await resolveEncryptionKey({ amphora, key });
    const aesKit = new AesKit({ kryptos });
    return aesKit.encrypt(data.toString("base64"));
  } catch (error) {
    if (error instanceof IrisEncryptionError) throw error;
    throw new IrisSerializationError("Failed to encrypt message payload", {
      code: "payload_encryption_failed",
      title: "Payload Encryption Failed",
      details:
        "The message payload could not be encrypted. Verify that a matching encryption key is available in the Amphora.",
      error: error instanceof Error ? error : undefined,
    });
  }
};

export const decryptPayload = async (
  data: string,
  context: MessageEncryptionContext | null | undefined,
  encrypted: MetaEncrypted,
): Promise<Buffer> => {
  if (!context?.amphora) {
    throw new IrisNotSupportedError(
      "@Encrypted requires an Amphora instance but none was configured",
      {
        code: "missing_amphora_instance",
        title: "Missing Amphora Instance",
        details:
          "A message marked with @Encrypted requires an Amphora instance to decrypt its payload, but none was configured on the source.",
      },
    );
  }

  const amphora = context.amphora;
  const key = mergeEncryptionKey(encrypted, context.key);

  try {
    const { AesKit, parseAes } = await import("@lindorm/aes");
    const { keyId } = parseAes(data);
    // The payload names the key that encrypted it — which may be an injected KEK
    // that was never added to the vault. That key is the only thing that can
    // unwrap what it wrapped, so the descriptor is consulted here too.
    const kryptos = await resolveEncryptionKey({ amphora, key, id: keyId });
    const aesKit = new AesKit({ kryptos });
    const decrypted = aesKit.decrypt<string>(data);
    return Buffer.from(decrypted, "base64");
  } catch (error) {
    if (error instanceof IrisEncryptionError) throw error;
    throw new IrisSerializationError("Failed to decrypt message payload", {
      code: "payload_decryption_failed",
      title: "Payload Decryption Failed",
      details:
        "The message payload could not be decrypted. Verify that the key referenced by the encrypted payload is available in the Amphora.",
      error: error instanceof Error ? error : undefined,
    });
  }
};
