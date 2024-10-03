import { KryptosEncryption } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { createHmac } from "crypto";
import { AesError } from "../../../errors";
import { CreateHmacAuthTag, VerifyHmacAuthTag } from "../../../types/private";

const shaHash = (encryption: KryptosEncryption): ShaAlgorithm => {
  switch (encryption) {
    case "A128CBC-HS256":
      return "SHA256";

    case "A192CBC-HS384":
      return "SHA384";

    case "A256CBC-HS512":
      return "SHA512";

    default:
      throw new AesError("Unexpected algorithm");
  }
};

export const createHmacAuthTag = ({
  content,
  hashKey,
  initialisationVector,
  encryption,
}: CreateHmacAuthTag): Buffer => {
  const hmac = createHmac(shaHash(encryption), hashKey);

  hmac.update(initialisationVector);
  hmac.update(content);

  return hmac.digest();
};

export const assertHmacAuthTag = ({
  authTag,
  content,
  encryption,
  hashKey,
  initialisationVector,
}: VerifyHmacAuthTag): void => {
  const generated = createHmacAuthTag({
    content,
    encryption,
    hashKey,
    initialisationVector,
  });

  if (Buffer.compare(generated, authTag) === 0) return;

  throw new AesError("Auth tag verification failed");
};
