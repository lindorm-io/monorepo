import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError";
import { IrisSerializationError } from "../../../errors/IrisSerializationError";
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
      error: error instanceof Error ? error : undefined,
    });
  }
};

export const decryptPayload = async (
  data: string,
  amphora: IAmphora | null | undefined,
  predicate: AmphoraPredicate,
): Promise<Buffer> => {
  if (!amphora) {
    throw new IrisNotSupportedError(
      "@Encrypted requires an Amphora instance but none was configured",
    );
  }

  try {
    const { AesKit } = await import("@lindorm/aes");
    const kryptos = await amphora.find(predicate);
    const aesKit = new AesKit({ kryptos: kryptos as any });
    const decrypted = aesKit.decrypt<string>(data);
    return Buffer.from(decrypted, "base64");
  } catch (error) {
    if (error instanceof IrisNotSupportedError) throw error;
    throw new IrisSerializationError("Failed to decrypt message payload", {
      error: error instanceof Error ? error : undefined,
    });
  }
};
