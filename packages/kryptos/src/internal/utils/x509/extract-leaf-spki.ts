import { KryptosError } from "../../../errors/index.js";
import {
  ASN1_CONTEXT_CONSTRUCTED_BASE,
  ASN1_TAG_SEQUENCE,
  readTlv,
} from "../asn1/index.js";

export const extractLeafSpki = (der: Buffer): Buffer => {
  let outer;
  try {
    outer = readTlv(der, 0);
  } catch (err: any) {
    throw new KryptosError("Failed to extract SPKI: invalid DER", {
      code: "spki_extraction_failed",
      title: "SPKI Extraction Failed",
      details:
        "The outer certificate DER could not be parsed while extracting the leaf SubjectPublicKeyInfo.",
      debug: { error: err },
    });
  }

  if (outer.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Failed to extract SPKI: certificate is not a SEQUENCE", {
      code: "spki_extraction_failed",
      title: "SPKI Extraction Failed",
      details:
        "The outer Certificate structure is not an ASN.1 SEQUENCE while extracting the leaf SubjectPublicKeyInfo.",
    });
  }

  let tbs;
  try {
    tbs = readTlv(der, outer.contentStart);
  } catch (err: any) {
    throw new KryptosError("Failed to extract SPKI: invalid TBSCertificate", {
      code: "spki_extraction_failed",
      title: "SPKI Extraction Failed",
      details:
        "The TBSCertificate could not be parsed while extracting the leaf SubjectPublicKeyInfo.",
      debug: { error: err },
    });
  }

  if (tbs.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Failed to extract SPKI: TBSCertificate is not a SEQUENCE", {
      code: "spki_extraction_failed",
      title: "SPKI Extraction Failed",
      details:
        "The TBSCertificate structure is not an ASN.1 SEQUENCE while extracting the leaf SubjectPublicKeyInfo.",
    });
  }

  const tbsEnd = tbs.contentStart + tbs.contentLength;
  let offset = tbs.contentStart;

  const readChild = () => {
    if (offset >= tbsEnd) {
      throw new KryptosError("Failed to extract SPKI: TBSCertificate truncated", {
        code: "spki_extraction_failed",
        title: "SPKI Extraction Failed",
        details:
          "The TBSCertificate ended before the SubjectPublicKeyInfo field could be reached.",
      });
    }
    return readTlv(der, offset);
  };

  let child;
  try {
    child = readChild();

    if (child.tag === (ASN1_CONTEXT_CONSTRUCTED_BASE | 0)) {
      offset = child.nextOffset;
      child = readChild();
    }

    // skip serialNumber, signature, issuer, validity, subject
    for (let i = 0; i < 5; i++) {
      offset = child.nextOffset;
      child = readChild();
    }
  } catch (err: any) {
    if (err instanceof KryptosError) throw err;
    throw new KryptosError("Failed to extract SPKI: TBSCertificate walk failed", {
      code: "spki_extraction_failed",
      title: "SPKI Extraction Failed",
      details:
        "Walking the TBSCertificate fields to locate the SubjectPublicKeyInfo failed on a malformed TLV.",
      debug: { error: err },
    });
  }

  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError(
      "Failed to extract SPKI: subjectPublicKeyInfo is not a SEQUENCE",
      {
        code: "spki_extraction_failed",
        title: "SPKI Extraction Failed",
        details:
          "The field at the SubjectPublicKeyInfo position is not an ASN.1 SEQUENCE.",
      },
    );
  }

  return Buffer.from(der.subarray(offset, child.nextOffset));
};
