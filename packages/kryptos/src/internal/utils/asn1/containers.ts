import { KryptosError } from "../../../errors";
import { encodeLength } from "./length";
import { ASN1_CONTEXT_CONSTRUCTED_BASE, ASN1_TAG_SEQUENCE, ASN1_TAG_SET } from "./tags";
import { readTlv } from "./walker";

const wrap = (tag: number, content: Buffer): Buffer =>
  Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);

export const encodeSequence = (children: Array<Buffer>): Buffer =>
  wrap(ASN1_TAG_SEQUENCE, Buffer.concat(children));

// DER requires SET-OF elements to be sorted. All SET usages in this codebase
// are single-element or already-sorted at the call site, so no sort logic here.
export const encodeSet = (children: Array<Buffer>): Buffer =>
  wrap(ASN1_TAG_SET, Buffer.concat(children));

export const encodeExplicitTag = (tagNumber: number, inner: Buffer): Buffer => {
  if (tagNumber < 0 || tagNumber > 30) {
    throw new KryptosError(`Unsupported context tag number: ${tagNumber}`);
  }
  return wrap(ASN1_CONTEXT_CONSTRUCTED_BASE | tagNumber, inner);
};

export const encodeImplicitTag = (
  tagNumber: number,
  contentBytes: Buffer,
  constructed = false,
): Buffer => {
  if (tagNumber < 0 || tagNumber > 30) {
    throw new KryptosError(`Unsupported context tag number: ${tagNumber}`);
  }
  const classBits = 0x80 | (constructed ? 0x20 : 0x00) | tagNumber;
  return wrap(classBits, contentBytes);
};

export const readSequenceChildren = (
  bytes: Buffer,
): Array<{ tag: number; content: Buffer }> => {
  const children: Array<{ tag: number; content: Buffer }> = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tlv = readTlv(bytes, offset);
    children.push({
      tag: tlv.tag,
      content: bytes.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength),
    });
    offset = tlv.nextOffset;
  }
  return children;
};
