import { X509Certificate } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosType } from "../../../types";
import { spkiFromPublicKey } from "./spki-from-public-key";

const certSpkiDer = (cert: X509Certificate): Buffer => {
  const exported = cert.publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(exported)) {
    throw new KryptosError("Failed to export certificate public key as SPKI DER");
  }
  return exported;
};

export const x509PublicKeyMatches = (
  cert: X509Certificate,
  kryptosPublicKey: Buffer,
  kryptosType: KryptosType,
): boolean => {
  const certSpki = certSpkiDer(cert);
  const keySpki = spkiFromPublicKey(kryptosPublicKey, kryptosType);
  return certSpki.equals(keySpki);
};
