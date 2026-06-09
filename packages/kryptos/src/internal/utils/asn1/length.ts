import { KryptosError } from "../../../errors/index.js";

export const encodeLength = (n: number): Buffer => {
  if (!Number.isInteger(n) || n < 0) {
    throw new KryptosError(`Invalid ASN.1 length: ${n}`, {
      code: "invalid_der_length",
      title: "Invalid DER Length",
      details: "A DER length to encode must be a non-negative integer.",
    });
  }

  if (n < 0x80) {
    return Buffer.from([n]);
  }

  const bytes: Array<number> = [];
  let remaining = n;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }

  if (bytes.length > 0x7e) {
    throw new KryptosError(`ASN.1 length too large: ${n}`, {
      code: "invalid_der_length",
      title: "Invalid DER Length",
      details: "The long-form length requires more than 126 length octets to encode.",
    });
  }

  return Buffer.from([0x80 | bytes.length, ...bytes]);
};

export const decodeLength = (
  bytes: Buffer,
  offset: number,
): { length: number; headerLength: number } => {
  if (offset >= bytes.length) {
    throw new KryptosError("Unexpected end of ASN.1 length", {
      code: "invalid_der_length",
      title: "Invalid DER Length",
      details: "The length offset is at or beyond the end of the buffer.",
    });
  }

  const first = bytes[offset];

  if (first < 0x80) {
    return { length: first, headerLength: 1 };
  }

  const count = first & 0x7f;
  if (count === 0) {
    throw new KryptosError("Indefinite-length ASN.1 encoding not supported", {
      code: "invalid_der_length",
      title: "Invalid DER Length",
      details: "Indefinite-length form (0x80) is not permitted in DER encoding.",
    });
  }
  if (offset + 1 + count > bytes.length) {
    throw new KryptosError("Unexpected end of ASN.1 long-form length", {
      code: "invalid_der_length",
      title: "Invalid DER Length",
      details: "The declared long-form length octets extend past the end of the buffer.",
    });
  }

  let length = 0;
  for (let i = 0; i < count; i++) {
    length = (length << 8) | bytes[offset + 1 + i];
  }

  return { length, headerLength: 1 + count };
};
