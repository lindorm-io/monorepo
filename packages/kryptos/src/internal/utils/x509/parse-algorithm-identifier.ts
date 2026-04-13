import { KryptosError } from "../../../errors";
import {
  ASN1_TAG_OID,
  ASN1_TAG_SEQUENCE,
  decodeOid,
  readSequenceChildren,
  readTlv,
} from "../asn1";

export const parseX509AlgorithmIdentifier = (der: Buffer): string => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("AlgorithmIdentifier is not a SEQUENCE");
  }
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const children = readSequenceChildren(body);
  if (children.length === 0 || children[0].tag !== ASN1_TAG_OID) {
    throw new KryptosError("AlgorithmIdentifier missing OID");
  }
  return decodeOid(children[0].content);
};
