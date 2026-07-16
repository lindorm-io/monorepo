import { decode, encode } from "cbor2";
import { describe, expect, test } from "vitest";
import { CborError } from "../errors/index.js";
import type { CborKitSettings } from "../types/cbor-field.js";
import { CborKit } from "./CborKit.js";

const settings: CborKitSettings = {
  version: { label: 0, value: 1 },
  fields: [
    { key: "sub", label: 1, kind: "text" },
    { key: "iat", label: 2, kind: "date" },
    { key: "amr", label: 3, kind: "enum", enum: { pwd: 1, otp: 2 } },
    { key: "sig", label: 4, kind: "bstr", encoding: "b64u" },
  ],
};

describe("CborKit", () => {
  const kit = new CborKit(settings);

  const record = {
    sub: "user-123",
    iat: new Date("2026-07-16T00:00:00.000Z"),
    amr: "otp",
    sig: "AQIDBA",
  };

  test("should round-trip a record", () => {
    expect(kit.decode(kit.encode(record))).toEqual(record);
  });

  test("should pin the wire format", () => {
    expect(Buffer.from(kit.encode(record)).toString("hex")).toMatchSnapshot();
  });

  test("should reject an invalid spec at construction", () => {
    expect(
      () =>
        new CborKit({
          fields: [
            { key: "a", label: 1, kind: "text" },
            { key: "b", label: 1, kind: "int" },
          ],
        }),
    ).toThrow(CborError);
  });

  test("should throw when decoding a record of a different version", () => {
    const other = new CborKit({ ...settings, version: { label: 0, value: 2 } });

    expect(() => kit.decode(other.encode(record))).toThrowError(
      expect.objectContaining({ code: "version_mismatch" }),
    );
  });
});

describe("CborKit — mixed labels and proprietary fields", () => {
  // A CWT-shaped spec: a registered integer label, a string-labelled short claim,
  // and a private-use integer label that degrades to its string key off-platform.
  const kit = new CborKit({
    labels: "mixed",
    mode: "lax",
    fields: [
      { key: "iss", label: 1, kind: "text" },
      { key: "acr", label: "acr", kind: "text" },
      { key: "client_id", label: -65548, kind: "text", proprietary: true },
    ],
  });

  const record = {
    iss: "https://idp.example",
    acr: "urn:acr:1",
    client_id: "client-1",
  };

  const wire = (bytes: Uint8Array): Map<unknown, unknown> =>
    decode<Map<unknown, unknown>>(bytes, { preferMap: true });

  test("should round-trip mixed integer and string labels", () => {
    expect(kit.decode(kit.encode(record))).toEqual(record);
  });

  test("should key a string-labelled field by its string label", () => {
    expect(wire(kit.encode(record)).get("acr")).toEqual("urn:acr:1");
  });

  test("should key a proprietary field by its integer label on-platform", () => {
    const map = wire(kit.encode(record));

    expect(map.get(-65548)).toEqual("client-1");
    expect(map.has("client_id")).toEqual(false);
  });

  test("should degrade a proprietary field to its string key off-platform", () => {
    const map = wire(kit.encode(record, { proprietary: false }));

    expect(map.get("client_id")).toEqual("client-1");
    expect(map.has(-65548)).toEqual(false);
    // Non-proprietary fields are unaffected by the flag.
    expect(map.get(1)).toEqual("https://idp.example");
    expect(map.get("acr")).toEqual("urn:acr:1");
  });

  test("should preserve an off-platform proprietary key via lax passthrough on decode", () => {
    // The string key is not a spec label, so lax decode keeps it verbatim; a
    // consumer (e.g. aegis) remaps the wire name back to its domain name.
    const decoded = kit.decode(kit.encode(record, { proprietary: false }));

    expect(decoded).toEqual({
      iss: "https://idp.example",
      acr: "urn:acr:1",
      client_id: "client-1",
    });
  });
});

describe("CborKit — map mode", () => {
  const kit = new CborKit({
    fields: [
      { key: "sub", label: 1, kind: "text" },
      { key: "scope", label: 2, kind: "array" },
    ],
  });

  const record = { sub: "user-1", scope: ["read", "write"] };

  test('encode("map") should build the intermediate wire map', () => {
    const map = kit.encode("map", record);

    expect(map).toBeInstanceOf(Map);
    expect(map.get(1)).toEqual("user-1");
    expect(map.get(2)).toEqual(["read", "write"]);
  });

  test('decode("map") should map a pre-decoded wire map back to the record', () => {
    expect(kit.decode("map", kit.encode("map", record))).toEqual(record);
  });

  test("serializing the map mode result equals the default byte mode", () => {
    // Fork C's guarantee: a consumer that owns its own serializer produces the
    // exact same bytes as the codec's own encode(value).
    const viaMap = encode(kit.encode("map", record), { cde: true });

    expect(Buffer.from(viaMap)).toEqual(Buffer.from(kit.encode(record)));
  });

  test("map mode should carry the proprietary option through", () => {
    const propKit = new CborKit({
      labels: "mixed",
      fields: [{ key: "client_id", label: -65548, kind: "text", proprietary: true }],
    });

    expect(propKit.encode("map", { client_id: "c-1" }).get(-65548)).toEqual("c-1");
    expect(
      propKit
        .encode("map", { client_id: "c-1" }, { proprietary: false })
        .get("client_id"),
    ).toEqual("c-1");
  });
});
