import { createPublicKey } from "crypto";
import { X509Certificate } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosType } from "../../../types";

const spkiDer = (cert: X509Certificate): Buffer => {
  const exported = cert.publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(exported)) {
    throw new KryptosError("Failed to export certificate public key as SPKI DER");
  }
  return exported;
};

const normaliseToSpkiDer = (publicKey: Buffer, type: KryptosType): Buffer => {
  // RSA public keys are stored as PKCS#1 DER inside kryptos; EC/OKP use SPKI DER.
  // oct keys have no public key and are rejected before reaching here.
  const sourceType = type === "RSA" ? "pkcs1" : "spki";
  const obj = createPublicKey({ key: publicKey, format: "der", type: sourceType });
  const out = obj.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(out)) {
    throw new KryptosError("Failed to normalise kryptos public key to SPKI DER");
  }
  return out;
};

export const x509PublicKeyMatches = (
  cert: X509Certificate,
  kryptosPublicKey: Buffer,
  kryptosType: KryptosType,
): boolean => {
  const certSpki = spkiDer(cert);
  const keySpki = normaliseToSpkiDer(kryptosPublicKey, kryptosType);
  return certSpki.equals(keySpki);
};
