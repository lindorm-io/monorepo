import { createHmac } from "crypto";
import { AesError } from "../../../errors";
import { CreateHmacAuthTag, VerifyHmacAuthTag } from "../../../types/auth-tag";

export const createHmacAuthTag = ({
  content,
  contentEncryptionKey,
  initialisationVector,
  integrityHash = "SHA256",
}: CreateHmacAuthTag): Buffer => {
  const hmac = createHmac(integrityHash, contentEncryptionKey);

  hmac.update(initialisationVector);
  hmac.update(content);

  return hmac.digest();
};

export const verifyHmacAuthTag = ({
  authTag,
  content,
  contentEncryptionKey,
  initialisationVector,
  integrityHash,
}: VerifyHmacAuthTag): void => {
  const generated = createHmacAuthTag({
    content,
    contentEncryptionKey,
    initialisationVector,
    integrityHash,
  });

  if (Buffer.compare(generated, authTag) === 0) return;

  throw new AesError("Auth tag verification failed");
};
