import { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesInternalEncryption } from "../../../types";

export const calculateAesEncryption = (
  encryption: KryptosEncryption,
): AesInternalEncryption => {
  if (!encryption) {
    throw new AesError("Encryption algorithm is required");
  }

  switch (encryption) {
    case "A128CBC-HS256":
      return "aes-128-cbc";

    case "A192CBC-HS384":
      return "aes-192-cbc";

    case "A256CBC-HS512":
      return "aes-256-cbc";

    case "A128GCM":
      return "aes-128-gcm";

    case "A192GCM":
      return "aes-192-gcm";

    case "A256GCM":
      return "aes-256-gcm";

    default:
      throw new AesError("Unsupported encryption algorithm");
  }
};
