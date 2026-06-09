import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError.js";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { AmphoraPredicate } from "@lindorm/amphora";
import type { IAmphora } from "@lindorm/amphora";

export const encryptPayload = async (
  data: Buffer,
  amphora: IAmphora | null | undefined,
  predicate: AmphoraPredicate,
): Promise<string> => {
  if (!amphora) {
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

  try {
    const { AesKit } = await import("@lindorm/aes");
    const kryptos = await amphora.find(predicate);
    const aesKit = new AesKit({ kryptos: kryptos as any });
    return aesKit.encrypt(data.toString("base64"), "tokenised");
  } catch (error) {
    if (error instanceof IrisNotSupportedError) throw error;
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
  amphora: IAmphora | null | undefined,
): Promise<Buffer> => {
  if (!amphora) {
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

  try {
    const { AesKit, parseAes } = await import("@lindorm/aes");
    const { keyId } = parseAes(data);
    const kryptos = await amphora.findById(keyId);
    const aesKit = new AesKit({ kryptos: kryptos as any });
    const decrypted = aesKit.decrypt<string>(data);
    return Buffer.from(decrypted, "base64");
  } catch (error) {
    if (error instanceof IrisNotSupportedError) throw error;
    throw new IrisSerializationError("Failed to decrypt message payload", {
      code: "payload_decryption_failed",
      title: "Payload Decryption Failed",
      details:
        "The message payload could not be decrypted. Verify that the key referenced by the encrypted payload is available in the Amphora.",
      error: error instanceof Error ? error : undefined,
    });
  }
};
