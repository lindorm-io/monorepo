import { KryptosError } from "../../../errors/index.js";
import { encodeLength } from "./length.js";
import {
  ASN1_TAG_BIT_STRING,
  ASN1_TAG_BOOLEAN,
  ASN1_TAG_GENERALIZED_TIME,
  ASN1_TAG_INTEGER,
  ASN1_TAG_NULL,
  ASN1_TAG_OCTET_STRING,
  ASN1_TAG_OID,
  ASN1_TAG_PRINTABLE_STRING,
  ASN1_TAG_UTC_TIME,
  ASN1_TAG_UTF8_STRING,
} from "./tags.js";

const wrap = (tag: number, content: Buffer): Buffer =>
  Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);

const pad2 = (n: number): string => n.toString().padStart(2, "0");
const pad4 = (n: number): string => n.toString().padStart(4, "0");

export const encodeInteger = (value: Buffer): Buffer => {
  let start = 0;
  while (
    start + 1 < value.length &&
    value[start] === 0x00 &&
    (value[start + 1] & 0x80) === 0
  ) {
    start++;
  }

  let content: Buffer;
  if (value.length === 0) {
    content = Buffer.from([0x00]);
  } else if (value[start] & 0x80) {
    content = Buffer.concat([Buffer.from([0x00]), value.subarray(start)]);
  } else {
    content = value.subarray(start);
  }

  return wrap(ASN1_TAG_INTEGER, content);
};

export const decodeInteger = (bytes: Buffer): Buffer => {
  if (bytes.length > 1 && bytes[0] === 0x00) {
    return Buffer.from(bytes.subarray(1));
  }
  return Buffer.from(bytes);
};

// `>>>` is a 32-bit unsigned shift, so subidentifiers above 2^31 - 1 would
// silently mis-encode. Real-world OIDs never approach this — cap and throw.
const OID_SUBIDENTIFIER_MAX = 0x7fffffff;

export const encodeOid = (dotted: string): Buffer => {
  const parts = dotted.split(".").map((p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0) {
      throw new KryptosError(`Invalid OID component: ${p}`);
    }
    if (n > OID_SUBIDENTIFIER_MAX) {
      throw new KryptosError(`OID subidentifier exceeds encoder range: ${p}`);
    }
    return n;
  });

  if (parts.length < 2) {
    throw new KryptosError(`OID must have at least two components: ${dotted}`);
  }

  const [first, second, ...rest] = parts;
  if (first > 2 || (first < 2 && second >= 40)) {
    throw new KryptosError(`Invalid OID prefix: ${dotted}`);
  }

  const encodeSub = (n: number): Array<number> => {
    if (n === 0) return [0];
    const out: Array<number> = [];
    let v = n;
    while (v > 0) {
      out.unshift(v & 0x7f);
      v >>>= 7;
    }
    for (let i = 0; i < out.length - 1; i++) {
      out[i] |= 0x80;
    }
    return out;
  };

  const bytes: Array<number> = [];
  bytes.push(...encodeSub(first * 40 + second));
  for (const n of rest) {
    bytes.push(...encodeSub(n));
  }

  return wrap(ASN1_TAG_OID, Buffer.from(bytes));
};

export const decodeOid = (bytes: Buffer): string => {
  if (bytes.length === 0) {
    throw new KryptosError("Empty OID content");
  }

  const subs: Array<number> = [];
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 7) | (bytes[i] & 0x7f);
    if ((bytes[i] & 0x80) === 0) {
      subs.push(value);
      value = 0;
    }
  }

  const combined = subs[0];
  const first = combined >= 80 ? 2 : Math.floor(combined / 40);
  const second = combined >= 80 ? combined - 80 : combined % 40;

  return [first, second, ...subs.slice(1)].join(".");
};

export const encodeOctetString = (bytes: Buffer): Buffer =>
  wrap(ASN1_TAG_OCTET_STRING, bytes);

export const decodeOctetString = (bytes: Buffer): Buffer => Buffer.from(bytes);

export const encodeUtf8String = (value: string): Buffer =>
  wrap(ASN1_TAG_UTF8_STRING, Buffer.from(value, "utf8"));

export const decodeUtf8String = (bytes: Buffer): string => bytes.toString("utf8");

export const encodePrintableString = (value: string): Buffer =>
  wrap(ASN1_TAG_PRINTABLE_STRING, Buffer.from(value, "ascii"));

export const decodePrintableString = (bytes: Buffer): string => bytes.toString("ascii");

export const encodeUtcTime = (date: Date): Buffer => {
  const y = date.getUTCFullYear();
  if (y < 1950 || y > 2049) {
    throw new KryptosError(`UTCTime out of range: ${y}`);
  }
  const yy = (y % 100).toString().padStart(2, "0");
  const str =
    yy +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z";
  return wrap(ASN1_TAG_UTC_TIME, Buffer.from(str, "ascii"));
};

export const decodeUtcTime = (bytes: Buffer): Date => {
  const str = bytes.toString("ascii");
  if (!/^\d{12}Z$/.test(str)) {
    throw new KryptosError(`Invalid UTCTime: ${str}`);
  }
  const yy = parseInt(str.slice(0, 2), 10);
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  const iso = `${year}-${str.slice(2, 4)}-${str.slice(4, 6)}T${str.slice(6, 8)}:${str.slice(8, 10)}:${str.slice(10, 12)}Z`;
  return new Date(iso);
};

export const encodeGeneralizedTime = (date: Date): Buffer => {
  const str =
    pad4(date.getUTCFullYear()) +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z";
  return wrap(ASN1_TAG_GENERALIZED_TIME, Buffer.from(str, "ascii"));
};

export const decodeGeneralizedTime = (bytes: Buffer): Date => {
  const str = bytes.toString("ascii");
  if (!/^\d{14}Z$/.test(str)) {
    throw new KryptosError(`Invalid GeneralizedTime: ${str}`);
  }
  const iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${str.slice(8, 10)}:${str.slice(10, 12)}:${str.slice(12, 14)}Z`;
  return new Date(iso);
};

export const encodeTime = (date: Date): Buffer => {
  const y = date.getUTCFullYear();
  return y >= 1950 && y <= 2049 ? encodeUtcTime(date) : encodeGeneralizedTime(date);
};

export const decodeTime = (bytes: Buffer, tag: number): Date => {
  if (tag === ASN1_TAG_UTC_TIME) return decodeUtcTime(bytes);
  if (tag === ASN1_TAG_GENERALIZED_TIME) return decodeGeneralizedTime(bytes);
  throw new KryptosError(`Unexpected time tag: 0x${tag.toString(16)}`);
};

export const encodeBitString = (bytes: Buffer, unusedBits = 0): Buffer => {
  if (unusedBits < 0 || unusedBits > 7) {
    throw new KryptosError(`Invalid unused bits: ${unusedBits}`);
  }
  return wrap(ASN1_TAG_BIT_STRING, Buffer.concat([Buffer.from([unusedBits]), bytes]));
};

export const decodeBitString = (bytes: Buffer): { bytes: Buffer; unusedBits: number } => {
  if (bytes.length === 0) {
    throw new KryptosError("Empty BIT STRING content");
  }
  return { bytes: Buffer.from(bytes.subarray(1)), unusedBits: bytes[0] };
};

export const encodeBoolean = (value: boolean): Buffer =>
  wrap(ASN1_TAG_BOOLEAN, Buffer.from([value ? 0xff : 0x00]));

export const decodeBoolean = (bytes: Buffer): boolean => {
  if (bytes.length !== 1) {
    throw new KryptosError("Invalid BOOLEAN length");
  }
  return bytes[0] !== 0x00;
};

export const encodeNull = (): Buffer => Buffer.from([ASN1_TAG_NULL, 0x00]);
