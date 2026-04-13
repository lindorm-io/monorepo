import {
  encodeExplicitTag,
  encodeImplicitTag,
  encodeSequence,
  encodeSet,
  readSequenceChildren,
} from "./containers";
import { encodeInteger, encodeUtf8String } from "./primitives";
import { readTlv } from "./walker";

describe("encodeSequence", () => {
  test("wraps children with SEQUENCE tag", () => {
    const seq = encodeSequence([
      encodeInteger(Buffer.from([0x01])),
      encodeInteger(Buffer.from([0x02])),
    ]);
    expect(seq.toString("hex")).toBe("3006020101020102");
  });

  test("empty sequence", () => {
    expect(encodeSequence([]).toString("hex")).toBe("3000");
  });
});

describe("encodeSet", () => {
  test("wraps children with SET tag", () => {
    const set = encodeSet([encodeInteger(Buffer.from([0x05]))]);
    expect(set.toString("hex")).toBe("3103020105");
  });
});

describe("encodeExplicitTag", () => {
  test("wraps inner with context-constructed tag", () => {
    const inner = encodeInteger(Buffer.from([0x02]));
    const explicit = encodeExplicitTag(0, inner);
    expect(explicit[0]).toBe(0xa0);
    expect(explicit.subarray(2).equals(inner)).toBe(true);
  });

  test("tag number 3 → 0xa3", () => {
    const explicit = encodeExplicitTag(3, encodeInteger(Buffer.from([0x00])));
    expect(explicit[0]).toBe(0xa3);
  });
});

describe("encodeImplicitTag", () => {
  test("primitive context tag [6] for SAN URI", () => {
    const uriBytes = Buffer.from("https://example.com", "ascii");
    const implicit = encodeImplicitTag(6, uriBytes, false);
    expect(implicit[0]).toBe(0x86);
    expect(implicit[1]).toBe(uriBytes.length);
    expect(implicit.subarray(2).equals(uriBytes)).toBe(true);
  });

  test("constructed implicit tag sets the constructed bit", () => {
    const implicit = encodeImplicitTag(0, Buffer.from([0xaa, 0xbb]), true);
    expect(implicit[0]).toBe(0xa0);
  });
});

describe("readSequenceChildren", () => {
  test("reads children of an encoded SEQUENCE", () => {
    const a = encodeInteger(Buffer.from([0x10]));
    const b = encodeUtf8String("ok");
    const seq = encodeSequence([a, b]);

    const tlv = readTlv(seq, 0);
    const body = seq.subarray(tlv.contentStart, tlv.contentStart + tlv.contentLength);
    const children = readSequenceChildren(body);

    expect(children).toHaveLength(2);
    expect(children[0].tag).toBe(0x02);
    expect(children[0].content.toString("hex")).toBe("10");
    expect(children[1].tag).toBe(0x0c);
    expect(children[1].content.toString("ascii")).toBe("ok");
  });

  test("yields nothing for empty content", () => {
    expect(readSequenceChildren(Buffer.alloc(0))).toEqual([]);
  });
});
