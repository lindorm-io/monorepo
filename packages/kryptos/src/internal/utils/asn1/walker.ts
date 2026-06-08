import { KryptosError } from "../../../errors/index.js";
import { decodeLength } from "./length.js";

export const readTlv = (
  buffer: Buffer,
  offset: number,
): {
  tag: number;
  contentStart: number;
  contentLength: number;
  nextOffset: number;
} => {
  if (offset >= buffer.length) {
    throw new KryptosError("Unexpected end of ASN.1 buffer", {
      code: "invalid_asn1_structure",
    });
  }

  const tag = buffer[offset];
  const { length, headerLength } = decodeLength(buffer, offset + 1);
  const contentStart = offset + 1 + headerLength;
  const nextOffset = contentStart + length;

  if (nextOffset > buffer.length) {
    throw new KryptosError("ASN.1 TLV exceeds buffer length", {
      code: "invalid_asn1_structure",
    });
  }

  return { tag, contentStart, contentLength: length, nextOffset };
};
