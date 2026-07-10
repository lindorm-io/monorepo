import {
  X509_OID_ECDSA_WITH_SHA256,
  X509_OID_ECDSA_WITH_SHA384,
  X509_OID_ECDSA_WITH_SHA512,
  X509_OID_ED25519,
  X509_OID_ED448,
  X509_OID_ML_DSA_44,
  X509_OID_ML_DSA_65,
  X509_OID_ML_DSA_87,
  X509_OID_SHA256_WITH_RSA,
  X509_OID_SHA384_WITH_RSA,
  X509_OID_SHA512_WITH_RSA,
} from "./oids.js";

// Human-readable name for a certificate signature-algorithm OID. Display only:
// an unrecognised OID falls through verbatim rather than throwing, since a
// foreign certificate may legitimately use an algorithm kryptos never mints.
export const signAlgorithmName = (oid: string): string => {
  switch (oid) {
    case X509_OID_ECDSA_WITH_SHA256:
      return "ECDSA-SHA256";
    case X509_OID_ECDSA_WITH_SHA384:
      return "ECDSA-SHA384";
    case X509_OID_ECDSA_WITH_SHA512:
      return "ECDSA-SHA512";
    case X509_OID_ED25519:
      return "Ed25519";
    case X509_OID_ED448:
      return "Ed448";
    case X509_OID_ML_DSA_44:
      return "ML-DSA-44";
    case X509_OID_ML_DSA_65:
      return "ML-DSA-65";
    case X509_OID_ML_DSA_87:
      return "ML-DSA-87";
    case X509_OID_SHA256_WITH_RSA:
      return "RSA-SHA256";
    case X509_OID_SHA384_WITH_RSA:
      return "RSA-SHA384";
    case X509_OID_SHA512_WITH_RSA:
      return "RSA-SHA512";
    default:
      return oid;
  }
};
