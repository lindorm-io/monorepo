import { KryptosEncryption } from "@lindorm/kryptos";
import { AesKeyLength } from "@lindorm/types";
import { AesError } from "../../../errors";

export const calculateContentEncryptionKeySize = (
  encryption: KryptosEncryption,
): AesKeyLength => {
  if (!encryption) {
    throw new AesError("Encryption algorithm is required");
  }

  switch (encryption) {
    case "A128GCM":
      return 16;

    case "A192GCM":
      return 24;

    case "A256GCM":
      return 32;

    case "A128CBC-HS256":
      return 48;

    case "A192CBC-HS384":
      return 72;

    case "A256CBC-HS512":
      return 96;

    default:
      throw new AesError("Unsupported encryption", { debug: { encryption } });
  }
};
