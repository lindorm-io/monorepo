import { RsaPrivateKey, constants } from "crypto";
import { RsaOaepHash } from "../../enums";
import { AesCipherKey } from "../../types";
import { mapRsaOaepHashToShaAlgorithm } from "./oaep-hash-mapper";

export const getKeyObject = (key: AesCipherKey, oaepHash?: RsaOaepHash): RsaPrivateKey => ({
  ...(typeof key === "string" ? { key } : key),
  padding: constants.RSA_PKCS1_OAEP_PADDING,
  ...(oaepHash ? { oaepHash: mapRsaOaepHashToShaAlgorithm(oaepHash) } : {}),
});
