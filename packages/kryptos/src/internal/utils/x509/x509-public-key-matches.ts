import { createPublicKey } from "crypto";
import { X509Certificate } from "crypto";
import { KryptosError } from "../../../errors";

const spkiDer = (cert: X509Certificate): Buffer => {
  const exported = cert.publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(exported)) {
    throw new KryptosError("Failed to export certificate public key as SPKI DER");
  }
  return exported;
};

const normaliseToSpkiDer = (publicKey: Buffer): Buffer => {
  const obj = createPublicKey({ key: publicKey, format: "der", type: "spki" });
  const out = obj.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(out)) {
    throw new KryptosError("Failed to normalise kryptos public key to SPKI DER");
  }
  return out;
};

export const x509PublicKeyMatches = (
  cert: X509Certificate,
  kryptosPublicKey: Buffer,
): boolean => {
  const certSpki = spkiDer(cert);
  const keySpki = normaliseToSpkiDer(kryptosPublicKey);
  return certSpki.equals(keySpki);
};
