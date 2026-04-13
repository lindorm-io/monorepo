import { KryptosType } from "../../../types";
import { computeSubjectKeyIdentifier } from "./encode-extensions";
import { spkiFromPublicKey } from "./spki-from-public-key";

export const computeSpkiKeyIdentifier = (
  publicKey: Buffer,
  type: KryptosType,
): Buffer => {
  const spki = spkiFromPublicKey(publicKey, type);
  return computeSubjectKeyIdentifier(spki);
};
