import type { KryptosType } from "../../../types/index.js";
import { computeSubjectKeyIdentifier } from "./encode-extensions.js";
import { spkiFromPublicKey } from "./spki-from-public-key.js";

export const computeSpkiKeyIdentifier = (
  publicKey: Buffer,
  type: KryptosType,
): Buffer => {
  const spki = spkiFromPublicKey(publicKey, type);
  return computeSubjectKeyIdentifier(spki);
};
