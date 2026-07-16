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
