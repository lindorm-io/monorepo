import { KryptosError } from "../../../errors";
import { ASN1_CONTEXT_CONSTRUCTED_BASE, ASN1_TAG_SEQUENCE, readTlv } from "../asn1";

export const extractLeafSpki = (der: Buffer): Buffer => {
  let outer;
  try {
    outer = readTlv(der, 0);
  } catch (err: any) {
    throw new KryptosError("Failed to extract SPKI: invalid DER", { error: err });
  }

  if (outer.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Failed to extract SPKI: certificate is not a SEQUENCE");
  }

  let tbs;
  try {
    tbs = readTlv(der, outer.contentStart);
  } catch (err: any) {
    throw new KryptosError("Failed to extract SPKI: invalid TBSCertificate", {
      error: err,
    });
  }

  if (tbs.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Failed to extract SPKI: TBSCertificate is not a SEQUENCE");
  }

  const tbsEnd = tbs.contentStart + tbs.contentLength;
  let offset = tbs.contentStart;

  const readChild = () => {
    if (offset >= tbsEnd) {
      throw new KryptosError("Failed to extract SPKI: TBSCertificate truncated");
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
      error: err,
    });
  }

  if (child.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError(
      "Failed to extract SPKI: subjectPublicKeyInfo is not a SEQUENCE",
    );
  }

  return Buffer.from(der.subarray(offset, child.nextOffset));
};
