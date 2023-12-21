import { createHmac } from "crypto";
import { AesIntegrityAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { CreateHmacAuthTag, VerifyHmacAuthTag } from "../../types/auth-tag";

export const createHmacAuthTag = ({
  content,
  encryptionKey,
  initialisationVector,
  integrityAlgorithm = AesIntegrityAlgorithm.SHA256,
}: CreateHmacAuthTag): Buffer => {
  const hmac = createHmac(integrityAlgorithm, encryptionKey);

  hmac.update(initialisationVector);
  hmac.update(content);

  return hmac.digest();
};

export const verifyHmacAuthTag = ({
  authTag,
  content,
  encryptionKey,
  initialisationVector,
  integrityAlgorithm,
}: VerifyHmacAuthTag): void => {
  const generated = createHmacAuthTag({
    content,
    encryptionKey,
    initialisationVector,
    integrityAlgorithm,
  });

  if (Buffer.compare(generated, authTag) === 0) return;

  throw new AesError("Auth tag verification failed", {
    description: "Auth tag verification failed",
  });
};
