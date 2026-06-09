import { KryptosError } from "../../../errors/index.js";
import {
  ASN1_TAG_OID,
  ASN1_TAG_SEQUENCE,
  decodeOid,
  readSequenceChildren,
  readTlv,
} from "../asn1/index.js";

export const parseX509AlgorithmIdentifier = (der: Buffer): string => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("AlgorithmIdentifier is not a SEQUENCE", {
      code: "invalid_algorithm_identifier",
      title: "Invalid Algorithm Identifier",
      details:
        "The AlgorithmIdentifier is not an ASN.1 SEQUENCE as required by RFC 5280 §4.1.1.2.",
    });
  }
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const children = readSequenceChildren(body);
  if (children.length === 0 || children[0].tag !== ASN1_TAG_OID) {
    throw new KryptosError("AlgorithmIdentifier missing OID", {
      code: "invalid_algorithm_identifier",
      title: "Invalid Algorithm Identifier",
      details:
        "The AlgorithmIdentifier SEQUENCE does not begin with an OBJECT IDENTIFIER naming the algorithm.",
    });
  }
  return decodeOid(children[0].content);
};
