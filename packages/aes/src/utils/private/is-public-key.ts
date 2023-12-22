import { isEcJwk, isEcPem, isOctPem, isRsaJwk, isRsaPem } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { AesEncryptionKey } from "../../types";

export const isPublicKey = (key?: AesEncryptionKey): boolean => {
  if (!key) {
    return false;
  }

  if (isRsaPem(key) || isEcPem(key)) {
    return typeof key.publicKey === "string" && key.publicKey.includes("PUBLIC KEY");
  }

  if (isOctPem(key)) {
    return false;
  }

  if (isRsaJwk(key)) {
    return typeof key.e === "string" && typeof key.n === "string" && key.d === undefined;
  }

  if (isEcJwk(key)) {
    return typeof key.x === "string" && typeof key.y === "string" && key.d === undefined;
  }

  throw new AesError("Unexpected key format", { debug: { key } });
};
