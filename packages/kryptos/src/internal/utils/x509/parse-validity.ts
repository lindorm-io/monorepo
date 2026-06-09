import { KryptosError } from "../../../errors/index.js";
import {
  ASN1_TAG_SEQUENCE,
  decodeTime,
  readSequenceChildren,
  readTlv,
} from "../asn1/index.js";

export const parseX509Validity = (der: Buffer): { notBefore: Date; notAfter: Date } => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Validity is not a SEQUENCE", {
      code: "invalid_certificate_validity",
      title: "Invalid Certificate Validity",
      details:
        "The certificate Validity field is not an ASN.1 SEQUENCE as required by RFC 5280.",
    });
  }
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const children = readSequenceChildren(body);
  if (children.length !== 2) {
    throw new KryptosError("Validity must have exactly two children", {
      code: "invalid_certificate_validity",
      title: "Invalid Certificate Validity",
      details: `The certificate Validity SEQUENCE must contain exactly two Time values (notBefore and notAfter) but contained ${children.length}.`,
      data: { childCount: children.length },
    });
  }
  const notBefore = decodeTime(children[0].content, children[0].tag);
  const notAfter = decodeTime(children[1].content, children[1].tag);
  return { notBefore, notAfter };
};
