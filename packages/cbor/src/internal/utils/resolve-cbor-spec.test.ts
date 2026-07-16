import { describe, expect, test } from "vitest";
import type { CborKitSettings } from "../../types/cbor-field.js";
import { resolveCborSpec } from "./resolve-cbor-spec.js";

describe("resolveCborSpec", () => {
  test("should resolve a valid spec", () => {
    const settings: CborKitSettings = {
      version: { label: 0, value: 1 },
      fields: [
        { key: "sub", label: 1, kind: "text" },
        { key: "iat", label: 2, kind: "date" },
        { key: "amr", label: 3, kind: "enum", enum: { pwd: 1, otp: 2 } },
        { key: "sig", label: 4, kind: "bstr", encoding: "b64u" },
      ],
    };

    const resolved = resolveCborSpec(settings);

    expect(resolved.version).toEqual({ label: 0, value: 1 });
    expect(resolved.fields).toHaveLength(4);
    expect(resolved.byLabel.get(1)?.key).toEqual("sub");
    expect(resolved.byLabel.get(4)?.key).toEqual("sig");
  });

  test("should default the unknown-label mode to strict", () => {
    expect(
      resolveCborSpec({ fields: [{ key: "a", label: 1, kind: "text" }] }).mode,
    ).toEqual("strict");
  });

  test("should carry an explicit lax mode through", () => {
    expect(
      resolveCborSpec({ mode: "lax", fields: [{ key: "a", label: 1, kind: "text" }] })
        .mode,
    ).toEqual("lax");
  });

  test("should precompute the reverse enum map", () => {
    const resolved = resolveCborSpec({
      fields: [{ key: "amr", label: 1, kind: "enum", enum: { pwd: 1, otp: 2 } }],
    });

    expect(resolved.byLabel.get(1)?.reverseEnum).toEqual({ 1: "pwd", 2: "otp" });
  });

  test("should throw on duplicate labels", () => {
    expect(() =>
      resolveCborSpec({
        fields: [
          { key: "a", label: 1, kind: "text" },
          { key: "b", label: 1, kind: "int" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "duplicate_label" }));
  });

  test("should throw when a field label collides with the version label", () => {
    expect(() =>
      resolveCborSpec({
        version: { label: 0, value: 1 },
        fields: [{ key: "a", label: 0, kind: "text" }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should throw when a positive field label collides with a non-zero version label", () => {
    expect(() =>
      resolveCborSpec({
        version: { label: 9, value: 1 },
        fields: [{ key: "a", label: 9, kind: "text" }],
      }),
    ).toThrowError(expect.objectContaining({ code: "duplicate_label" }));
  });

  test("should throw on a non-integer label", () => {
    expect(() =>
      resolveCborSpec({ fields: [{ key: "a", label: 1.5, kind: "text" }] }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should throw on a zero label", () => {
    expect(() =>
      resolveCborSpec({ fields: [{ key: "a", label: 0, kind: "text" }] }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should allow a negative integer label", () => {
    const resolved = resolveCborSpec({
      fields: [{ key: "a", label: -65552, kind: "text" }],
    });

    expect(resolved.byLabel.get(-65552)?.key).toEqual("a");
  });

  test("should default the label mode to int and reject a string label", () => {
    expect(() =>
      resolveCborSpec({ fields: [{ key: "acr", label: "acr", kind: "text" }] }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should allow a string label when labels is mixed", () => {
    const resolved = resolveCborSpec({
      labels: "mixed",
      fields: [
        { key: "acr", label: "acr", kind: "text" },
        { key: "iss", label: 1, kind: "text" },
      ],
    });

    expect(resolved.byLabel.get("acr")?.key).toEqual("acr");
    expect(resolved.byLabel.get(1)?.key).toEqual("iss");
  });

  test("should throw on an empty string label", () => {
    expect(() =>
      resolveCborSpec({
        labels: "mixed",
        fields: [{ key: "a", label: "", kind: "text" }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should throw when a proprietary field has a string label", () => {
    expect(() =>
      resolveCborSpec({
        labels: "mixed",
        fields: [{ key: "a", label: "a", kind: "text", proprietary: true }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_label" }));
  });

  test("should register a proprietary field under both its label and its key", () => {
    const resolved = resolveCborSpec({
      fields: [{ key: "client_id", label: -65548, kind: "text", proprietary: true }],
    });

    expect(resolved.byLabel.get(-65548)?.key).toEqual("client_id");
    expect(resolved.byLabel.get("client_id")?.key).toEqual("client_id");
  });

  test("should throw when a proprietary key collides with another field's wire key", () => {
    expect(() =>
      resolveCborSpec({
        labels: "mixed",
        fields: [
          { key: "sub_id", label: "sub_id", kind: "text" },
          { key: "sub_id", label: -65549, kind: "text", proprietary: true },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "duplicate_label" }));
  });

  test("should throw when kind is enum but no enum map is given", () => {
    expect(() =>
      resolveCborSpec({ fields: [{ key: "a", label: 1, kind: "enum" }] }),
    ).toThrowError(expect.objectContaining({ code: "invalid_enum_config" }));
  });

  test("should throw when an enum map is given for a non-enum kind", () => {
    expect(() =>
      resolveCborSpec({
        fields: [{ key: "a", label: 1, kind: "int", enum: { x: 1 } }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_enum_config" }));
  });

  test("should throw when an enum maps two values to the same wire code", () => {
    expect(() =>
      resolveCborSpec({
        fields: [{ key: "a", label: 1, kind: "enum", enum: { x: 1, y: 1 } }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_enum_config" }));
  });

  test("should throw when kind is bespoke but encode/decode are missing", () => {
    expect(() =>
      resolveCborSpec({ fields: [{ key: "a", label: 1, kind: "bespoke" }] }),
    ).toThrowError(expect.objectContaining({ code: "invalid_bespoke_config" }));

    expect(() =>
      resolveCborSpec({
        fields: [{ key: "a", label: 1, kind: "bespoke", encode: (v) => v }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_bespoke_config" }));
  });

  test("should throw when encode/decode are given for a non-bespoke kind", () => {
    expect(() =>
      resolveCborSpec({
        fields: [{ key: "a", label: 1, kind: "int", encode: (v) => v, decode: (v) => v }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_bespoke_config" }));
  });

  test("should throw when encoding is set on a non-bstr kind", () => {
    expect(() =>
      resolveCborSpec({
        fields: [{ key: "a", label: 1, kind: "text", encoding: "b64u" }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_encoding_config" }));
  });

  test("should allow encoding on bstr and bstrArray", () => {
    expect(() =>
      resolveCborSpec({
        fields: [
          { key: "a", label: 1, kind: "bstr", encoding: "b64u" },
          { key: "b", label: 2, kind: "bstrArray", encoding: "base64" },
        ],
      }),
    ).not.toThrow();
  });
});
