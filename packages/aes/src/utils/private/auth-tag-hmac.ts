import { createHmac } from "crypto";
import { AesIntegrityHash } from "../../enums";
import { AesError } from "../../errors";
import { CreateHmacAuthTag, VerifyHmacAuthTag } from "../../types/auth-tag";

export const createHmacAuthTag = ({
  content,
  encryptionKey,
  initialisationVector,
  integrityHash = AesIntegrityHash.SHA256,
}: CreateHmacAuthTag): Buffer => {
  const hmac = createHmac(integrityHash, encryptionKey);

  hmac.update(initialisationVector);
  hmac.update(content);

  return hmac.digest();
};

export const verifyHmacAuthTag = ({
  authTag,
  content,
  encryptionKey,
  initialisationVector,
  integrityHash,
}: VerifyHmacAuthTag): void => {
  const generated = createHmacAuthTag({
    content,
    encryptionKey,
    initialisationVector,
    integrityHash,
  });

  if (Buffer.compare(generated, authTag) === 0) return;

  throw new AesError("Auth tag verification failed", {
    description: "Auth tag verification failed",
  });
};
