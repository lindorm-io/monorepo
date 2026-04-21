import { encodeSequence } from "./containers";
import { encodeInteger } from "./primitives";
import { readTlv } from "./walker";
import { describe, expect, test } from "vitest";

describe("readTlv", () => {
  test("reads a simple integer TLV", () => {
    const encoded = encodeInteger(Buffer.from([0x42]));
    const tlv = readTlv(encoded, 0);
    expect(tlv).toEqual({
      tag: 0x02,
      contentStart: 2,
      contentLength: 1,
      nextOffset: 3,
    });
  });

  test("walks siblings via nextOffset", () => {
    const a = encodeInteger(Buffer.from([0x01]));
    const b = encodeInteger(Buffer.from([0x02]));
    const seq = encodeSequence([a, b]);

    const outer = readTlv(seq, 0);
    expect(outer.tag).toBe(0x30);

    const firstChild = readTlv(seq, outer.contentStart);
    expect(firstChild.tag).toBe(0x02);

    const secondChild = readTlv(seq, firstChild.nextOffset);
    expect(secondChild.tag).toBe(0x02);
    expect(secondChild.nextOffset).toBe(outer.nextOffset);
  });

  test("throws when TLV exceeds buffer", () => {
    expect(() => readTlv(Buffer.from([0x02, 0x05, 0x00]), 0)).toThrow();
  });

  test("throws at end of buffer", () => {
    expect(() => readTlv(Buffer.alloc(0), 0)).toThrow();
  });
});
