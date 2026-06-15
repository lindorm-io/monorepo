import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import { decodeCbor, encodeCbor, Tag } from "./cbor.js";

describe("cbor bootstrap", () => {
  test("round-trips primitives, arrays, and integer-keyed maps", () => {
    expect(decodeCbor(encodeCbor(42))).toBe(42);
    expect(decodeCbor(encodeCbor([1, "two"]))).toEqual([1, "two"]);

    const cwt = new Map<number, unknown>([
      [1, "https://issuer"],
      [4, 1700000000],
    ]);
    const decoded = decodeCbor<Map<number, unknown>>(encodeCbor(cwt));
    expect(decoded).toBeInstanceOf(Map);
    expect(decoded.get(1)).toBe("https://issuer");
    expect(decoded.get(4)).toBe(1700000000);
  });

  test("encodes a Node Buffer as a CBOR byte string (0x44…), not a map", () => {
    const encoded = encodeCbor(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    expect(encoded.toString("hex")).toBe("44deadbeef");

    const decoded = decodeCbor<Uint8Array>(encoded);
    expect(Buffer.from(decoded)).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  });

  test("is deterministic: key order does not affect the bytes", () => {
    const a = encodeCbor(
      new Map([
        [3, 4],
        [1, 2],
      ]),
    );
    const b = encodeCbor(
      new Map([
        [1, 2],
        [3, 4],
      ]),
    );
    expect(a.equals(b)).toBe(true);
    // canonical: {1:2, 3:4} = a2 01 02 03 04
    expect(a.toString("hex")).toBe("a2010203 04".replace(/\s/g, ""));
  });

  test("rejects duplicate map keys and wraps errors as AegisError", () => {
    const duplicate = Buffer.from("a201010102", "hex"); // {1:1, 1:2}
    expect(() => decodeCbor(duplicate)).toThrow(AegisError);

    const truncated = Buffer.from("8201", "hex"); // array of 2, one element
    expect(() => decodeCbor(truncated)).toThrow(AegisError);
  });

  test("round-trips a tagged value (COSE/CWT tag)", () => {
    const decoded = decodeCbor<Tag>(encodeCbor(new Tag(61, [1, 2])), {
      preferMap: false,
    });
    expect(decoded).toBeInstanceOf(Tag);
    expect(decoded.tag).toBe(61);
  });
});
