import type { KryptosType } from "../../../types/index.js";
import { spkiFromPublicKey } from "./spki-from-public-key.js";

export const x509PublicKeyMatches = (
  subjectPublicKeyInfo: Buffer,
  kryptosPublicKey: Buffer,
  kryptosType: KryptosType,
): boolean => {
  const keySpki = spkiFromPublicKey(kryptosPublicKey, kryptosType);
  return subjectPublicKeyInfo.equals(keySpki);
};
