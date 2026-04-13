import { KryptosError } from "../../../errors";
import { ASN1_TAG_SEQUENCE, decodeTime, readSequenceChildren, readTlv } from "../asn1";

export const parseX509Validity = (der: Buffer): { notBefore: Date; notAfter: Date } => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Validity is not a SEQUENCE");
  }
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const children = readSequenceChildren(body);
  if (children.length !== 2) {
    throw new KryptosError("Validity must have exactly two children");
  }
  const notBefore = decodeTime(children[0].content, children[0].tag);
  const notAfter = decodeTime(children[1].content, children[1].tag);
  return { notBefore, notAfter };
};
