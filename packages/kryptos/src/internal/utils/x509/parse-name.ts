import { KryptosError } from "../../../errors";
import { ParsedX509Name } from "../../../types";
import {
  ASN1_TAG_OID,
  ASN1_TAG_PRINTABLE_STRING,
  ASN1_TAG_SEQUENCE,
  ASN1_TAG_SET,
  ASN1_TAG_UTF8_STRING,
  decodeOid,
  decodePrintableString,
  decodeUtf8String,
  readSequenceChildren,
  readTlv,
} from "../asn1";
import { X509_OID_COMMON_NAME, X509_OID_ORGANIZATION_NAME } from "./oids";

const decodeDirectoryString = (tag: number, content: Buffer): string => {
  if (tag === ASN1_TAG_UTF8_STRING) return decodeUtf8String(content);
  if (tag === ASN1_TAG_PRINTABLE_STRING) return decodePrintableString(content);
  // Accept other string types as raw ASCII/latin1 to not reject unknown but common DirectoryString choices.
  return content.toString("latin1");
};

export const parseX509Name = (der: Buffer): ParsedX509Name => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Name is not a SEQUENCE");
  }
  const raw = Buffer.from(der.subarray(0, tlv.nextOffset));
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);

  let commonName: string | undefined;
  let organization: string | undefined;

  for (const rdn of readSequenceChildren(body)) {
    if (rdn.tag !== ASN1_TAG_SET) continue;
    for (const attr of readSequenceChildren(rdn.content)) {
      if (attr.tag !== ASN1_TAG_SEQUENCE) continue;
      const pair = readSequenceChildren(attr.content);
      if (pair.length < 2 || pair[0].tag !== ASN1_TAG_OID) continue;
      const oid = decodeOid(pair[0].content);
      const value = decodeDirectoryString(pair[1].tag, pair[1].content);
      if (oid === X509_OID_COMMON_NAME && commonName === undefined) {
        commonName = value;
      } else if (oid === X509_OID_ORGANIZATION_NAME && organization === undefined) {
        organization = value;
      }
    }
  }

  const result: ParsedX509Name = {
    ...(commonName !== undefined ? { commonName } : {}),
    ...(organization !== undefined ? { organization } : {}),
    raw,
  };
  return result;
};
