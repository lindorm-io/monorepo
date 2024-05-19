import { KryptosEncryption } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors";

export const _getInitialisationVector = (encryption: KryptosEncryption): Buffer => {
  switch (encryption) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return randomBytes(16);

    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return randomBytes(12);

    default:
      throw new AesError("Unexpected algorithm", {
        debug: { encryption },
      });
  }
};
