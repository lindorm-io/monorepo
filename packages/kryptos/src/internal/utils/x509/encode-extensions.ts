import { ShaKit } from "@lindorm/sha";
import { KryptosError } from "../../../errors";
import {
  ASN1_TAG_BIT_STRING,
  encodeBitString,
  encodeBoolean,
  encodeImplicitTag,
  encodeInteger,
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

export type X509KeyUsageFlag =
  | "digitalSignature"
  | "nonRepudiation"
  | "keyEncipherment"
  | "dataEncipherment"
  | "keyAgreement"
  | "keyCertSign"
  | "cRLSign"
  | "encipherOnly"
  | "decipherOnly";

export type X509BasicConstraints = {
  ca: boolean;
  pathLengthConstraint?: number;
};

export const wrapExtension = (oid: string, inner: Buffer, critical = false): Buffer => {
  const children: Array<Buffer> = [encodeOid(oid)];
  if (critical) {
    children.push(encodeBoolean(true));
  }
  children.push(encodeOctetString(inner));
  return encodeSequence(children);
};

export const basicConstraintsExt = (
  { ca, pathLengthConstraint }: X509BasicConstraints,
  critical = true,
): Buffer => {
  if (!ca && pathLengthConstraint !== undefined) {
    throw new KryptosError(
      "basicConstraints.pathLengthConstraint is only valid when ca=true (RFC 5280 §4.2.1.9)",
    );
  }

  const seqChildren: Array<Buffer> = [];
  if (ca) {
    seqChildren.push(encodeBoolean(true));
    if (pathLengthConstraint !== undefined) {
      if (!Number.isInteger(pathLengthConstraint) || pathLengthConstraint < 0) {
        throw new KryptosError(
          "basicConstraints.pathLengthConstraint must be a non-negative integer",
        );
      }
      seqChildren.push(encodeInteger(Buffer.from([pathLengthConstraint & 0xff])));
    }
  }
  const inner = encodeSequence(seqChildren);
  return wrapExtension(X509_OID_EXT_BASIC_CONSTRAINTS, inner, critical);
};

const KEY_USAGE_BIT_ORDER: ReadonlyArray<X509KeyUsageFlag> = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly",
];

export const keyUsageExt = (
  flags: ReadonlyArray<X509KeyUsageFlag>,
  critical = true,
): Buffer => {
  if (flags.length === 0) {
    throw new KryptosError(
      "keyUsage extension requires at least one bit (RFC 5280 §4.2.1.3)",
    );
  }

  const bits: Array<number> = [];
  for (const flag of flags) {
    const index = KEY_USAGE_BIT_ORDER.indexOf(flag);
    if (index === -1) {
      throw new KryptosError(`Unknown keyUsage flag: ${flag}`);
    }
    bits.push(index);
  }

  const highestBit = Math.max(...bits);
  const byteLength = Math.floor(highestBit / 8) + 1;
  const unusedBits = byteLength * 8 - (highestBit + 1);
  const bytes = Buffer.alloc(byteLength, 0x00);

  for (const bit of bits) {
    const byteIndex = Math.floor(bit / 8);
    const bitWithinByte = 7 - (bit % 8);
    bytes[byteIndex] |= 1 << bitWithinByte;
  }

  const inner = encodeBitString(bytes, unusedBits);
  return wrapExtension(X509_OID_EXT_KEY_USAGE, inner, critical);
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
  const keyIdentifier = encodeImplicitTag(0, issuerSkiBytes, false);
  const inner = encodeSequence([keyIdentifier]);
  return wrapExtension(X509_OID_EXT_AUTHORITY_KEY_IDENTIFIER, inner, false);
};

export const subjectAlternativeNameExt = (sans: ReadonlyArray<string>): Buffer => {
  if (sans.length === 0) {
    throw new KryptosError("subjectAlternativeNameExt requires at least one SAN");
  }
  const children = sans.map((uri) =>
    encodeImplicitTag(6, Buffer.from(uri, "ascii"), false),
  );
  const inner = encodeSequence(children);
  return wrapExtension(X509_OID_EXT_SUBJECT_ALT_NAME, inner, false);
};
