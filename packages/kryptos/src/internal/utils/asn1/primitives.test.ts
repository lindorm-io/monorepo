import {
  decodeBitString,
  decodeBoolean,
  decodeGeneralizedTime,
  decodeInteger,
  decodeOctetString,
  decodeOid,
  decodePrintableString,
  decodeTime,
  decodeUtcTime,
  decodeUtf8String,
  encodeBitString,
  encodeBoolean,
  encodeGeneralizedTime,
  encodeInteger,
  encodeNull,
  encodeOctetString,
  encodeOid,
  encodePrintableString,
  encodeTime,
  encodeUtcTime,
  encodeUtf8String,
} from "./primitives.js";
import { ASN1_TAG_GENERALIZED_TIME, ASN1_TAG_UTC_TIME } from "./tags.js";
import { readTlv } from "./walker.js";
import { describe, expect, test } from "vitest";

const content = (buffer: Buffer): Buffer => {
  const tlv = readTlv(buffer, 0);
  return buffer.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
};

describe("encodeInteger / decodeInteger", () => {
  test.each([
    ["zero", Buffer.from([0x00]), "020100"],
    ["127", Buffer.from([0x7f]), "02017f"],
    ["128 (high bit set → prepend 0x00)", Buffer.from([0x80]), "02020080"],
    ["255", Buffer.from([0xff]), "020200ff"],
    ["256", Buffer.from([0x01, 0x00]), "02020100"],
    ["strips leading zeros", Buffer.from([0x00, 0x00, 0x01]), "020101"],
    ["keeps the sign byte", Buffer.from([0x00, 0xff]), "020200ff"],
  ])("%s", (_label, input, hex) => {
    const encoded = encodeInteger(input);
    expect(encoded.toString("hex")).toBe(hex);
  });

  test("empty buffer encodes as INTEGER 0", () => {
    expect(encodeInteger(Buffer.alloc(0)).toString("hex")).toBe("020100");
  });

  test("round-trips (decoded value equals normalized input magnitude)", () => {
    const cases: Array<[Buffer, Buffer]> = [
      [Buffer.from([0x00]), Buffer.from([0x00])],
      [Buffer.from([0x7f]), Buffer.from([0x7f])],
      [Buffer.from([0x80]), Buffer.from([0x80])],
      [Buffer.from([0xff, 0xee, 0xdd]), Buffer.from([0xff, 0xee, 0xdd])],
      [
        Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
        Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
      ],
      [Buffer.from([0x00, 0x00, 0x01]), Buffer.from([0x01])],
      [Buffer.from([0x00, 0xff]), Buffer.from([0xff])],
    ];
    for (const [input, expected] of cases) {
      const decoded = decodeInteger(content(encodeInteger(input)));
      expect(decoded.equals(expected)).toBe(true);
    }
  });
});

describe("encodeOid / decodeOid", () => {
  test("sha256WithRSAEncryption", () => {
    const oid = "1.2.840.113549.1.1.11";
    const encoded = encodeOid(oid);
    expect(encoded.toString("hex")).toBe("06092a864886f70d01010b");
    expect(decodeOid(content(encoded))).toBe(oid);
  });

  test("ecPublicKey", () => {
    const oid = "1.2.840.10045.2.1";
    const encoded = encodeOid(oid);
    expect(encoded.toString("hex")).toBe("06072a8648ce3d0201");
    expect(decodeOid(content(encoded))).toBe(oid);
  });

  test("commonName short form", () => {
    const oid = "2.5.4.3";
    expect(encodeOid(oid).toString("hex")).toBe("0603550403");
    expect(decodeOid(content(encodeOid(oid)))).toBe(oid);
  });

  test("joint-iso-itu-t large second component", () => {
    const oid = "2.100.3";
    expect(decodeOid(content(encodeOid(oid)))).toBe(oid);
  });

  test("rejects malformed OID", () => {
    expect(() => encodeOid("bad")).toThrow();
    expect(() => encodeOid("1")).toThrow();
  });

  test("rejects subidentifier above 32-bit unsigned range", () => {
    // 2^31 = 2147483648 is one above the encoder cap (2^31 - 1).
    expect(() => encodeOid("1.2.2147483648")).toThrow("exceeds encoder range");
  });
});

describe("octet/utf8/printable strings", () => {
  test("round-trips octet string", () => {
    const input = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const encoded = encodeOctetString(input);
    expect(encoded[0]).toBe(0x04);
    expect(decodeOctetString(content(encoded)).equals(input)).toBe(true);
  });

  test("round-trips utf8 string", () => {
    const encoded = encodeUtf8String("hëllo");
    expect(encoded[0]).toBe(0x0c);
    expect(decodeUtf8String(content(encoded))).toBe("hëllo");
  });

  test("round-trips printable string", () => {
    const encoded = encodePrintableString("CA Root");
    expect(encoded[0]).toBe(0x13);
    expect(decodePrintableString(content(encoded))).toBe("CA Root");
  });
});

describe("time encoding", () => {
  test("encodeUtcTime matches known format", () => {
    const date = new Date("2024-01-15T10:20:30Z");
    const encoded = encodeUtcTime(date);
    expect(encoded.toString("hex")).toMatchSnapshot();
    expect(content(encoded).toString("ascii")).toBe("240115102030Z");
  });

  test("encodeGeneralizedTime matches known format", () => {
    const date = new Date("2050-06-07T08:09:10Z");
    const encoded = encodeGeneralizedTime(date);
    expect(content(encoded).toString("ascii")).toBe("20500607080910Z");
  });

  test("encodeTime dispatches UTCTime for 2049", () => {
    const date = new Date("2049-12-31T23:59:59Z");
    const encoded = encodeTime(date);
    expect(encoded[0]).toBe(ASN1_TAG_UTC_TIME);
  });

  test("encodeTime dispatches GeneralizedTime for 2050", () => {
    const date = new Date("2050-01-01T00:00:00Z");
    const encoded = encodeTime(date);
    expect(encoded[0]).toBe(ASN1_TAG_GENERALIZED_TIME);
  });

  test("round-trips UTCTime", () => {
    const date = new Date("1999-07-22T04:05:06Z");
    const decoded = decodeUtcTime(content(encodeUtcTime(date)));
    expect(decoded.toISOString()).toBe(date.toISOString());
  });

  test("round-trips GeneralizedTime", () => {
    const date = new Date("2075-11-30T23:30:00Z");
    const decoded = decodeGeneralizedTime(content(encodeGeneralizedTime(date)));
    expect(decoded.toISOString()).toBe(date.toISOString());
  });

  test("decodeTime dispatches by tag", () => {
    const utc = encodeUtcTime(new Date("2030-02-03T04:05:06Z"));
    const gen = encodeGeneralizedTime(new Date("2099-02-03T04:05:06Z"));
    expect(decodeTime(content(utc), ASN1_TAG_UTC_TIME).toISOString()).toBe(
      "2030-02-03T04:05:06.000Z",
    );
    expect(decodeTime(content(gen), ASN1_TAG_GENERALIZED_TIME).toISOString()).toBe(
      "2099-02-03T04:05:06.000Z",
    );
    expect(() => decodeTime(Buffer.alloc(0), 0x99)).toThrow();
  });

  test("encodeUtcTime rejects out-of-range years", () => {
    expect(() => encodeUtcTime(new Date("2050-01-01T00:00:00Z"))).toThrow();
    expect(() => encodeUtcTime(new Date("1949-12-31T23:59:59Z"))).toThrow();
  });
});

describe("bit string", () => {
  test("encodes with default unused bits", () => {
    const encoded = encodeBitString(Buffer.from([0xaa, 0xbb]));
    expect(encoded.toString("hex")).toBe("030300aabb");
  });

  test("round-trips with unused bits", () => {
    const encoded = encodeBitString(Buffer.from([0xf0]), 4);
    const decoded = decodeBitString(content(encoded));
    expect(decoded.unusedBits).toBe(4);
    expect(decoded.bytes.equals(Buffer.from([0xf0]))).toBe(true);
  });

  test("rejects invalid unused bits", () => {
    expect(() => encodeBitString(Buffer.from([0x00]), 8)).toThrow();
    expect(() => encodeBitString(Buffer.from([0x00]), -1)).toThrow();
  });

  test("decodeBitString rejects empty content", () => {
    expect(() => decodeBitString(Buffer.alloc(0))).toThrow();
  });
});

describe("boolean / null", () => {
  test("encodeBoolean true/false", () => {
    expect(encodeBoolean(true).toString("hex")).toBe("0101ff");
    expect(encodeBoolean(false).toString("hex")).toBe("010100");
  });

  test("round-trips boolean", () => {
    expect(decodeBoolean(content(encodeBoolean(true)))).toBe(true);
    expect(decodeBoolean(content(encodeBoolean(false)))).toBe(false);
  });

  test("decodeBoolean rejects wrong length", () => {
    expect(() => decodeBoolean(Buffer.from([0x00, 0x00]))).toThrow();
  });

  test("encodeNull", () => {
    expect(encodeNull().toString("hex")).toBe("0500");
  });
});
