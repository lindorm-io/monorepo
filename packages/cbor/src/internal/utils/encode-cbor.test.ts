import { decode } from "cbor2";
import { describe, expect, test } from "vitest";
import { CborKit } from "../../classes/CborKit.js";
import type { CborKitSettings } from "../../types/cbor-field.js";
import { decodeCbor } from "./decode-cbor.js";
import { encodeCbor } from "./encode-cbor.js";
import { resolveCborSpec } from "./resolve-cbor-spec.js";

// A nested kit used through a "bespoke" field, to prove codec composition.
const nested = new CborKit({
  fields: [
    { key: "city", label: 1, kind: "text" },
    { key: "zip", label: 2, kind: "text" },
  ],
});

const settings: CborKitSettings = {
  version: { label: 0, value: 1 },
  fields: [
    { key: "sub", label: 1, kind: "text" },
    { key: "count", label: 2, kind: "int" },
    { key: "iat", label: 3, kind: "date" },
    { key: "active", label: 4, kind: "bool" },
    { key: "amr", label: 5, kind: "enum", enum: { pwd: 1, otp: 2 } },
    { key: "sig", label: 6, kind: "bstr", encoding: "b64u" },
    { key: "raw", label: 7, kind: "bstr" },
    { key: "chain", label: 8, kind: "bstrArray", encoding: "base64" },
    {
      key: "address",
      label: 9,
      kind: "bespoke",
      encode: (v) => nested.encode(v as Record<string, unknown>),
      decode: (v) => nested.decode(v as Uint8Array),
    },
  ],
};

const config = resolveCborSpec(settings);

const record = {
  sub: "user-123",
  count: 7,
  iat: new Date("2026-07-16T00:00:00.000Z"),
  active: true,
  amr: "otp",
  sig: "AQIDBA",
  raw: Buffer.from([5, 6, 7]),
  chain: ["AQID", "BAUG"],
  address: { city: "Oslo", zip: "0150" },
};

describe("encodeCbor", () => {
  test("should round-trip every kind, including a bespoke nested kit", () => {
    const bytes = encodeCbor(config, record);
    const decoded = decodeCbor(config, bytes);

    expect(decoded).toEqual(record);
  });

  test("should auto-write the version tag", () => {
    const map = decode<Map<number, unknown>>(encodeCbor(config, record), {
      preferMap: true,
    });

    expect(map.get(0)).toEqual(1);
  });

  test("should skip undefined and null fields", () => {
    const map = decode<Map<number, unknown>>(
      encodeCbor(config, { sub: "only", count: undefined, active: null }),
      { preferMap: true },
    );

    expect(map.has(1)).toEqual(true);
    expect(map.has(2)).toEqual(false);
    expect(map.has(4)).toEqual(false);
  });

  test("should skip empty-string text fields", () => {
    const map = decode<Map<number, unknown>>(encodeCbor(config, { sub: "" }), {
      preferMap: true,
    });

    expect(map.has(1)).toEqual(false);
  });

  test("should not emit a Buffer field as a CBOR object", () => {
    const map = decode<Map<number, unknown>>(
      encodeCbor(config, { raw: Buffer.from([1, 2]) }),
      {
        preferMap: true,
      },
    );

    expect(map.get(7)).toBeInstanceOf(Uint8Array);
    expect(Array.from(map.get(7) as Uint8Array)).toEqual([1, 2]);
  });
});
