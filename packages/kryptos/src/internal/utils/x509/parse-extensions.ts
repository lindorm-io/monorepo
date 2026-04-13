import { KryptosError } from "../../../errors";
import {
  ParsedX509Extensions,
  ParsedX509KeyUsageFlag,
  ParsedX509SubjectAltName,
} from "../../../types";
import {
  ASN1_TAG_BIT_STRING,
  ASN1_TAG_BOOLEAN,
  ASN1_TAG_OCTET_STRING,
  ASN1_TAG_OID,
  ASN1_TAG_SEQUENCE,
  decodeBitString,
  decodeBoolean,
  decodeOid,
  readSequenceChildren,
  readTlv,
} from "../asn1";
import {
  X509_OID_EXT_AUTHORITY_KEY_IDENTIFIER,
  X509_OID_EXT_BASIC_CONSTRAINTS,
  X509_OID_EXT_KEY_USAGE,
  X509_OID_EXT_SUBJECT_ALT_NAME,
  X509_OID_EXT_SUBJECT_KEY_IDENTIFIER,
} from "./oids";

const KEY_USAGE_BITS: ReadonlyArray<ParsedX509KeyUsageFlag> = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "crlSign",
  "encipherOnly",
  "decipherOnly",
];

const parseBasicConstraints = (extnValue: Buffer): { ca: boolean } => {
  const tlv = readTlv(extnValue, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("BasicConstraints is not a SEQUENCE");
  }
  const body = extnValue.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const children = readSequenceChildren(body);
  for (const child of children) {
    if (child.tag === ASN1_TAG_BOOLEAN) {
      return { ca: decodeBoolean(child.content) };
    }
  }
  return { ca: false };
};

const parseKeyUsage = (extnValue: Buffer): ReadonlyArray<ParsedX509KeyUsageFlag> => {
  const tlv = readTlv(extnValue, 0);
  if (tlv.tag !== ASN1_TAG_BIT_STRING) {
    throw new KryptosError("KeyUsage is not a BIT STRING");
  }
  const body = extnValue.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
  const { bytes, unusedBits } = decodeBitString(body);
  const totalBits = bytes.length * 8 - unusedBits;
  const flags: Array<ParsedX509KeyUsageFlag> = [];
  for (let i = 0; i < totalBits && i < KEY_USAGE_BITS.length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitWithinByte = 7 - (i % 8);
    if ((bytes[byteIndex] & (1 << bitWithinByte)) !== 0) {
      flags.push(KEY_USAGE_BITS[i]);
    }
  }
  return flags;
};

const parseSubjectKeyIdentifier = (extnValue: Buffer): Buffer => {
  const tlv = readTlv(extnValue, 0);
  if (tlv.tag !== ASN1_TAG_OCTET_STRING) {
    throw new KryptosError("SubjectKeyIdentifier is not an OCTET STRING");
  }
  return Buffer.from(
    extnValue.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength),
  );
};

const parseAuthorityKeyIdentifier = (extnValue: Buffer): Buffer | undefined => {
  const tlv = readTlv(extnValue, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("AuthorityKeyIdentifier is not a SEQUENCE");
  }
  let offset = tlv.contentStart;
  const end = tlv.contentStart + tlv.contentLength;
  while (offset < end) {
    const child = readTlv(extnValue, offset);
    // keyIdentifier [0] IMPLICIT OCTET STRING -> context primitive tag 0x80
    if (child.tag === 0x80) {
      return Buffer.from(
        extnValue.subarray(child.contentStart, child.contentStart + child.contentLength),
      );
    }
    offset = child.nextOffset;
  }
  return undefined;
};

const SAN_IMPLICIT_TAGS: Record<number, ParsedX509SubjectAltName["type"]> = {
  0x81: "email",
  0x82: "dns",
  0x86: "uri",
  0x87: "ip",
};

const parseSubjectAltNames = (
  extnValue: Buffer,
): ReadonlyArray<ParsedX509SubjectAltName> => {
  const tlv = readTlv(extnValue, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("SubjectAltName is not a SEQUENCE");
  }
  const names: Array<ParsedX509SubjectAltName> = [];
  let offset = tlv.contentStart;
  const end = tlv.contentStart + tlv.contentLength;
  while (offset < end) {
    const child = readTlv(extnValue, offset);
    const type = SAN_IMPLICIT_TAGS[child.tag];
    if (type !== undefined) {
      const content = extnValue.subarray(
        child.contentStart,
        child.contentStart + child.contentLength,
      );
      const value = type === "ip" ? content.toString("hex") : content.toString("ascii");
      names.push({ type, value });
    }
    offset = child.nextOffset;
  }
  return names;
};

export const parseX509Extensions = (der: Buffer): ParsedX509Extensions => {
  const tlv = readTlv(der, 0);
  if (tlv.tag !== ASN1_TAG_SEQUENCE) {
    throw new KryptosError("Extensions is not a SEQUENCE");
  }
  const body = der.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);

  let basicConstraintsCa = false;
  let keyUsage: ReadonlyArray<ParsedX509KeyUsageFlag> = [];
  let subjectKeyIdentifier: Buffer | undefined;
  let authorityKeyIdentifier: Buffer | undefined;
  let subjectAltNames: ReadonlyArray<ParsedX509SubjectAltName> = [];

  for (const ext of readSequenceChildren(body)) {
    if (ext.tag !== ASN1_TAG_SEQUENCE) continue;
    const parts = readSequenceChildren(ext.content);
    if (parts.length === 0 || parts[0].tag !== ASN1_TAG_OID) continue;
    const oid = decodeOid(parts[0].content);

    let critical = false;
    let valueIndex = 1;
    if (parts.length >= 2 && parts[1].tag === ASN1_TAG_BOOLEAN) {
      critical = decodeBoolean(parts[1].content);
      valueIndex = 2;
    }
    if (parts.length <= valueIndex || parts[valueIndex].tag !== ASN1_TAG_OCTET_STRING) {
      throw new KryptosError(`Extension ${oid} missing extnValue OCTET STRING`);
    }
    const extnValue = parts[valueIndex].content;

    if (oid === X509_OID_EXT_BASIC_CONSTRAINTS) {
      basicConstraintsCa = parseBasicConstraints(extnValue).ca;
    } else if (oid === X509_OID_EXT_KEY_USAGE) {
      keyUsage = parseKeyUsage(extnValue);
    } else if (oid === X509_OID_EXT_SUBJECT_KEY_IDENTIFIER) {
      subjectKeyIdentifier = parseSubjectKeyIdentifier(extnValue);
    } else if (oid === X509_OID_EXT_AUTHORITY_KEY_IDENTIFIER) {
      authorityKeyIdentifier = parseAuthorityKeyIdentifier(extnValue);
    } else if (oid === X509_OID_EXT_SUBJECT_ALT_NAME) {
      subjectAltNames = parseSubjectAltNames(extnValue);
    } else if (critical) {
      throw new KryptosError(`Unknown critical X.509 extension: ${oid}`);
    }
  }

  return {
    basicConstraintsCa,
    keyUsage,
    ...(subjectKeyIdentifier !== undefined ? { subjectKeyIdentifier } : {}),
    ...(authorityKeyIdentifier !== undefined ? { authorityKeyIdentifier } : {}),
    subjectAltNames,
  };
};
