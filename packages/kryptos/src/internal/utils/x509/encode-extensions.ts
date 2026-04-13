import { ShaKit } from "@lindorm/sha";
import { KryptosError } from "../../../errors";
import {
  ASN1_TAG_BIT_STRING,
  encodeBitString,
  encodeBoolean,
  encodeImplicitTag,
  encodeOctetString,
  encodeOid,
  encodeSequence,
  readTlv,
} from "../asn1";
import {
  X509_OID_EXT_AUTHORITY_KEY_IDENTIFIER,
  X509_OID_EXT_BASIC_CONSTRAINTS,
  X509_OID_EXT_KEY_USAGE,
  X509_OID_EXT_SUBJECT_ALT_NAME,
  X509_OID_EXT_SUBJECT_KEY_IDENTIFIER,
} from "./oids";

export const wrapExtension = (oid: string, inner: Buffer, critical = false): Buffer => {
  const children: Array<Buffer> = [encodeOid(oid)];
  if (critical) {
    children.push(encodeBoolean(true));
  }
  children.push(encodeOctetString(inner));
  return encodeSequence(children);
};

export const basicConstraintsExt = (isCa: boolean): Buffer => {
  const seqChildren: Array<Buffer> = [];
  if (isCa) {
    seqChildren.push(encodeBoolean(true));
  }
  const inner = encodeSequence(seqChildren);
  return wrapExtension(X509_OID_EXT_BASIC_CONSTRAINTS, inner, true);
};

export type KeyUsageFlags = {
  digitalSignature?: boolean;
  nonRepudiation?: boolean;
  keyEncipherment?: boolean;
  dataEncipherment?: boolean;
  keyAgreement?: boolean;
  keyCertSign?: boolean;
  crlSign?: boolean;
};

const KEY_USAGE_BIT_ORDER: ReadonlyArray<keyof KeyUsageFlags> = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "crlSign",
];

export const keyUsageExt = (flags: KeyUsageFlags): Buffer => {
  let highestBit = -1;
  for (let i = 0; i < KEY_USAGE_BIT_ORDER.length; i++) {
    if (flags[KEY_USAGE_BIT_ORDER[i]]) highestBit = i;
  }

  if (highestBit === -1) {
    throw new KryptosError("keyUsage extension requires at least one bit");
  }

  const byteLength = Math.floor(highestBit / 8) + 1;
  const unusedBits = byteLength * 8 - (highestBit + 1);
  const bytes = Buffer.alloc(byteLength, 0x00);

  for (let i = 0; i <= highestBit; i++) {
    if (flags[KEY_USAGE_BIT_ORDER[i]]) {
      const byteIndex = Math.floor(i / 8);
      const bitWithinByte = 7 - (i % 8);
      bytes[byteIndex] |= 1 << bitWithinByte;
    }
  }

  const inner = encodeBitString(bytes, unusedBits);
  return wrapExtension(X509_OID_EXT_KEY_USAGE, inner, true);
};

const extractBitStringBody = (spkiBytes: Buffer): Buffer => {
  const outer = readTlv(spkiBytes, 0);
  if (outer.tag !== 0x30) {
    throw new KryptosError("SPKI is not a SEQUENCE");
  }

  let offset = outer.contentStart;
  const end = outer.contentStart + outer.contentLength;

  while (offset < end) {
    const tlv = readTlv(spkiBytes, offset);
    if (tlv.tag === ASN1_TAG_BIT_STRING) {
      // The BIT STRING content byte 0 is the unusedBits count; the rest is the
      // subjectPublicKey payload we hash. RFC 5280 4.2.1.2 method (1).
      return spkiBytes.subarray(
        tlv.contentStart + 1,
        tlv.contentStart + tlv.contentLength,
      );
    }
    offset = tlv.nextOffset;
  }

  throw new KryptosError("SPKI has no BIT STRING child");
};

export const computeSubjectKeyIdentifier = (spkiBytes: Buffer): Buffer =>
  Buffer.from(ShaKit.S1(extractBitStringBody(spkiBytes)), "base64url");

export const subjectKeyIdentifierExt = (spkiBytes: Buffer): Buffer => {
  const ski = computeSubjectKeyIdentifier(spkiBytes);
  const inner = encodeOctetString(ski);
  return wrapExtension(X509_OID_EXT_SUBJECT_KEY_IDENTIFIER, inner, false);
};

export const authorityKeyIdentifierExt = (issuerSkiBytes: Buffer): Buffer => {
  // AuthorityKeyIdentifier ::= SEQUENCE { keyIdentifier [0] IMPLICIT OCTET STRING }
  const keyIdentifier = encodeImplicitTag(0, issuerSkiBytes, false);
  const inner = encodeSequence([keyIdentifier]);
  return wrapExtension(X509_OID_EXT_AUTHORITY_KEY_IDENTIFIER, inner, false);
};

export const subjectAlternativeNameExt = (sans: ReadonlyArray<string>): Buffer => {
  if (sans.length === 0) {
    throw new KryptosError("subjectAlternativeNameExt requires at least one SAN");
  }
  // Each SAN is encoded as GeneralName. URI is [6] IMPLICIT IA5String.
  const children = sans.map((uri) =>
    encodeImplicitTag(6, Buffer.from(uri, "ascii"), false),
  );
  const inner = encodeSequence(children);
  return wrapExtension(X509_OID_EXT_SUBJECT_ALT_NAME, inner, false);
};
