import { createHmac } from "crypto";
import { ShaAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { CreateHmacAuthTag, VerifyHmacAuthTag } from "../../types/auth-tag";

export const createHmacAuthTag = ({
  content,
  encryptionKey,
  initialisationVector,
}: CreateHmacAuthTag): Buffer => {
  const hmac = createHmac(ShaAlgorithm.SHA256, encryptionKey);

  hmac.update(initialisationVector);
  hmac.update(content);

  return hmac.digest();
};

export const verifyHmacAuthTag = ({
  authTag,
  content,
  encryptionKey,
  initialisationVector,
}: VerifyHmacAuthTag): void => {
  const generated = createHmacAuthTag({
    content,
    encryptionKey,
    initialisationVector,
  });

  if (Buffer.compare(generated, authTag) === 0) return;

  throw new AesError("Auth tag verification failed", {
    description: "Auth tag verification failed",
  });
};
