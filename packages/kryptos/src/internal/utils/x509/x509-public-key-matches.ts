import { KryptosType } from "../../../types";
import { spkiFromPublicKey } from "./spki-from-public-key";

export const x509PublicKeyMatches = (
  subjectPublicKeyInfo: Buffer,
  kryptosPublicKey: Buffer,
  kryptosType: KryptosType,
): boolean => {
  const keySpki = spkiFromPublicKey(kryptosPublicKey, kryptosType);
  return subjectPublicKeyInfo.equals(keySpki);
};
