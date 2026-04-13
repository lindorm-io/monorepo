import { ShaKit } from "@lindorm/sha";
import { isIPv4, isIPv6 } from "node:net";
import { KryptosError } from "../../../errors";
import { X509SubjectAltNameInput } from "../../../types/x509";
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

const SAN_IA5_TAG: Record<"email" | "dns" | "uri", number> = {
  email: 1,
  dns: 2,
  uri: 6,
};

const assertIa5String = (type: "uri" | "dns" | "email", value: string): void => {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0x7f) {
      throw new KryptosError(
        `subjectAlternativeName value for type '${type}' must be ASCII (IA5String)`,
      );
    }
  }
};

const parseIpv4 = (value: string): Buffer => {
  const parts = value.split(".");
  const bytes = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    bytes[i] = Number.parseInt(parts[i], 10);
  }
  return bytes;
};

const parseIpv6 = (value: string): Buffer => {
  const [head, tail] = value.includes("::") ? value.split("::") : [value, undefined];
  const splitGroups = (section: string): Array<string> =>
    section.length === 0 ? [] : section.split(":");

  const headGroups = splitGroups(head);
  const tailGroups = tail !== undefined ? splitGroups(tail) : [];

  const lastTail = tailGroups[tailGroups.length - 1];
  const hasEmbeddedIpv4 = lastTail !== undefined && lastTail.includes(".");
  let embeddedBytes: Buffer | undefined;
  if (hasEmbeddedIpv4) {
    embeddedBytes = parseIpv4(tailGroups.pop() as string);
  } else if (headGroups.length > 0 && headGroups[headGroups.length - 1].includes(".")) {
    embeddedBytes = parseIpv4(headGroups.pop() as string);
  }

  const existing = headGroups.length + tailGroups.length + (embeddedBytes ? 2 : 0);
  const missing = 8 - existing;
  const zeroFill: Array<string> = tail !== undefined ? new Array(missing).fill("0") : [];

  const groups: Array<string> = [...headGroups, ...zeroFill, ...tailGroups];

  const bytes = Buffer.alloc(16);
  for (let i = 0; i < groups.length; i++) {
    const word = Number.parseInt(groups[i], 16);
    bytes[i * 2] = (word >> 8) & 0xff;
    bytes[i * 2 + 1] = word & 0xff;
  }
  if (embeddedBytes) {
    bytes[12] = embeddedBytes[0];
    bytes[13] = embeddedBytes[1];
    bytes[14] = embeddedBytes[2];
    bytes[15] = embeddedBytes[3];
  }
  return bytes;
};

const encodeIpSan = (value: string): Buffer => {
  if (isIPv4(value)) {
    return encodeImplicitTag(7, parseIpv4(value), false);
  }
  if (isIPv6(value)) {
    return encodeImplicitTag(7, parseIpv6(value), false);
  }
  throw new KryptosError(
    `subjectAlternativeName ip value '${value}' is not a valid IPv4 or IPv6 address`,
  );
};

export const subjectAlternativeNameExt = (
  sans: ReadonlyArray<X509SubjectAltNameInput>,
): Buffer => {
  if (sans.length === 0) {
    throw new KryptosError("subjectAlternativeNameExt requires at least one SAN");
  }
  const children = sans.map((san) => {
    if (san.type === "ip") {
      return encodeIpSan(san.value);
    }
    assertIa5String(san.type, san.value);
    return encodeImplicitTag(
      SAN_IA5_TAG[san.type],
      Buffer.from(san.value, "ascii"),
      false,
    );
  });
  const inner = encodeSequence(children);
  return wrapExtension(X509_OID_EXT_SUBJECT_ALT_NAME, inner, false);
};
