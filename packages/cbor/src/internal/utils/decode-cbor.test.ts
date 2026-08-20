import type { Dict } from "@lindorm/types";
import { encode } from "cbor2";
import { describe, expect, test } from "vitest";
import { CborError } from "../../errors/index.js";
import type { CborKitSettings } from "../../types/cbor-field.js";
import { decodeCbor } from "./decode-cbor.js";
import { encodeCbor } from "./encode-cbor.js";
import { resolveCborSpec } from "./resolve-cbor-spec.js";

const settings: CborKitSettings = {
  version: { label: 0, value: 2 },
  fields: [
    { key: "sub", label: 1, kind: "text" },
    { key: "amr", label: 2, kind: "enum", enum: { pwd: 1, otp: 2 } },
  ],
};

const config = resolveCborSpec(settings);

describe("decodeCbor", () => {
  test("should decode a record written by encodeCbor", () => {
    const bytes = encodeCbor(config, { sub: "abc", amr: "pwd" });

    expect(decodeCbor(config, bytes)).toEqual({ sub: "abc", amr: "pwd" });
  });

  test("should not surface the version tag as a field", () => {
    const decoded = decodeCbor(config, encodeCbor(config, { sub: "abc" }));

    expect(decoded).toEqual({ sub: "abc" });
    expect(decoded).not.toHaveProperty("0");
  });

  test("should throw on a version mismatch", () => {
    const foreign = encode(new Map<number, unknown>([[0, 99]]), { cde: true });

    expect(() => decodeCbor(config, foreign)).toThrowError(
      expect.objectContaining({ code: "version_mismatch" }),
    );
    expect(() => decodeCbor(config, foreign)).toThrow(CborError);
  });

  test("should throw when the version tag is missing entirely", () => {
    const missing = encode(new Map<number, unknown>([[1, "abc"]]), { cde: true });

    expect(() => decodeCbor(config, missing)).toThrowError(
      expect.objectContaining({ code: "version_mismatch" }),
    );
  });

  test("should preserve an unknown label verbatim in lax mode", () => {
    const lax = resolveCborSpec({ ...settings, mode: "lax" });
    const withUnknown = encode(
      new Map<number, unknown>([
        [0, 2],
        [1, "abc"],
        [42, "future-field"],
      ]),
      { cde: true },
    );

    const decoded = decodeCbor(lax, withUnknown);

    expect(decoded).toEqual({ sub: "abc", 42: "future-field" });
  });

  test("should keep a __proto__ label as an own key and not let it choose the prototype", () => {
    const lax = resolveCborSpec({ ...settings, mode: "lax" });
    const hostile = encode(
      new Map<number | string, unknown>([
        [0, 2],
        [1, "abc"],
        ["__proto__", { pwn: "yes" }],
      ]),
      { cde: true },
    );

    const decoded = decodeCbor(lax, hostile);

    // ⚠ Asserted on the PROPERTY, never on `JSON.stringify`/`toEqual` alone: a
    // swapped prototype serialises as ABSENT, so a serialisation check reads
    // clean on exactly the input this test exists for.
    expect(Object.keys(decoded)).toContain("__proto__");
    expect(Object.getOwnPropertyDescriptor(decoded, "__proto__")?.value).toEqual(
      // `preferMap: true` (decode-cbor.ts) decodes a nested map AS a Map, and a
      // Map is an object — so it is a value the `__proto__` setter would have
      // accepted as a prototype, which is what makes it the right probe here.
      new Map([["pwn", "yes"]]),
    );
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(({} as Dict).pwn).toBeUndefined();
  });

  test("should throw on an unknown label by default (strict mode)", () => {
    const withUnknown = encode(
      new Map<number, unknown>([
        [0, 2],
        [1, "abc"],
        [42, "future-field"],
      ]),
      { cde: true },
    );

    expect(() => decodeCbor(config, withUnknown)).toThrowError(
      expect.objectContaining({ code: "unknown_label", data: { label: 42 } }),
    );
    expect(() => decodeCbor(config, withUnknown)).toThrow(CborError);
  });

  test("should decode with no version configured", () => {
    const versionless = resolveCborSpec({ fields: settings.fields });
    const bytes = encodeCbor(versionless, { sub: "abc", amr: "otp" });

    expect(decodeCbor(versionless, bytes)).toEqual({ sub: "abc", amr: "otp" });
  });
});
