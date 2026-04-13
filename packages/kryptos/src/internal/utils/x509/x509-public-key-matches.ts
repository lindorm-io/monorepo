import { ParsedX509Certificate, KryptosType } from "../../../types";
import { spkiFromPublicKey } from "./spki-from-public-key";

export const x509PublicKeyMatches = (
  cert: ParsedX509Certificate,
  kryptosPublicKey: Buffer,
  kryptosType: KryptosType,
): boolean => {
  const keySpki = spkiFromPublicKey(kryptosPublicKey, kryptosType);
  return cert.subjectPublicKeyInfo.equals(keySpki);
};
