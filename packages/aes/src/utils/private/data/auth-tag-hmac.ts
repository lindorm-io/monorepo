import { KryptosEncryption } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { createHmac, timingSafeEqual } from "crypto";
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

  // RFC 7518 Section 5.2.2.1: M = MAC(MAC_KEY, A || IV || E || AL)
  // A (AAD) is empty in this implementation
  // AL = bit length of A as 64-bit big-endian integer = 0
  hmac.update(initialisationVector);
  hmac.update(content);
  const al = Buffer.alloc(8); // 64-bit zero for empty AAD bit length
  hmac.update(al);

  const fullTag = hmac.digest();
  return fullTag.subarray(0, fullTag.length / 2);
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

  if (generated.length === authTag.length && timingSafeEqual(generated, authTag)) return;

  throw new AesError("Auth tag verification failed");
};
