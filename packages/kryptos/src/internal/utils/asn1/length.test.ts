import { decodeLength, encodeLength } from "./length";

describe("encodeLength / decodeLength", () => {
  test.each([
    [0, "00"],
    [1, "01"],
    [127, "7f"],
    [128, "8180"],
    [255, "81ff"],
    [256, "820100"],
    [65535, "82ffff"],
    [65536, "83010000"],
  ])("encodes %i", (n, hex) => {
    expect(encodeLength(n).toString("hex")).toBe(hex);
  });

  test.each([0, 1, 127, 128, 255, 256, 65535, 65536, 16777215])("round-trips %i", (n) => {
    const encoded = encodeLength(n);
    const decoded = decodeLength(encoded, 0);
    expect(decoded.length).toBe(n);
    expect(decoded.headerLength).toBe(encoded.length);
  });

  test("rejects negative length", () => {
    expect(() => encodeLength(-1)).toThrow();
  });

  test("rejects non-integer length", () => {
    expect(() => encodeLength(1.5)).toThrow();
  });

  test("rejects indefinite form", () => {
    expect(() => decodeLength(Buffer.from([0x80]), 0)).toThrow();
  });

  test("rejects truncated long form", () => {
    expect(() => decodeLength(Buffer.from([0x82, 0x01]), 0)).toThrow();
  });

  test("decodes with offset", () => {
    const buf = Buffer.from([0xaa, 0xbb, 0x7f, 0xcc]);
    expect(decodeLength(buf, 2)).toEqual({ length: 127, headerLength: 1 });
  });
});
