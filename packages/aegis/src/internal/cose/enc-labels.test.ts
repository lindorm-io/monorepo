import type { KryptosEncryption } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import {
  coseLabelToEnc,
  encToCoseLabel,
  isOfficialCoseEnc,
  tagBytesForEncryption,
} from "./enc-labels.js";

describe("enc-labels", () => {
  const pairs = [
    ["A128GCM", 1],
    ["A192GCM", 2],
    ["A256GCM", 3],
    ["AES-CCM-16-64-128", 10],
    ["AES-CCM-16-64-256", 11],
    ["AES-CCM-64-64-128", 12],
    ["AES-CCM-64-64-256", 13],
    ["AES-CCM-16-128-128", 30],
    ["AES-CCM-16-128-256", 31],
    ["AES-CCM-64-128-128", 32],
    ["AES-CCM-64-128-256", 33],
  ] as const;

  test.each(pairs)("%s <-> COSE label %i round-trips", (enc, label) => {
    expect(encToCoseLabel(enc)).toBe(label);
    expect(coseLabelToEnc(label)).toBe(enc);
  });

  // The AES-CBC-HMAC family has no official COSE registration, so it maps to a
  // private-use label and a proprietary COSE_Encrypt0 still round-trips.
  const cbcPairs = [
    ["A128CBC-HS256", -65537],
    ["A192CBC-HS384", -65538],
    ["A256CBC-HS512", -65539],
  ] as const;

  test.each(cbcPairs)(
    "%s <-> private-use COSE label %i round-trips (proprietary)",
    (enc, label) => {
      expect(encToCoseLabel(enc)).toBe(label);
      expect(coseLabelToEnc(label)).toBe(enc);
    },
  );

  test("rejects a missing encryption / an unknown label", () => {
    expect(() => encToCoseLabel(undefined)).toThrow(AegisError);
    expect(() => encToCoseLabel(null)).toThrow(AegisError);
    expect(() => coseLabelToEnc(999)).toThrow(AegisError);
  });

  /**
   * Every table here is a plain object, so a bare index resolves through
   * `Object.prototype` and `COSE_TO_ENC["toString"]` is a FUNCTION that clears
   * both the `??` chain and the `undefined` guard. Read through `own-entry.ts`.
   *
   * ⚠ The label direction is TOKEN-controlled — `CweKit.decrypt` reads it off a
   * foreign protected header, pinned in `CweKit.test.ts`. These rows pin the table
   * itself, both directions.
   */
  const PROTO_NAMES = ["constructor", "toString", "valueOf", "hasOwnProperty"];

  test.each(PROTO_NAMES)("`%s` is not an official COSE encryption", (name) => {
    expect(isOfficialCoseEnc(name as KryptosEncryption)).toBe(false);
  });

  test.each(PROTO_NAMES)("`%s` has no COSE label and is refused", (name) => {
    expect(() => encToCoseLabel(name as KryptosEncryption)).toThrow(
      expect.objectContaining({ code: "cose_encryption_not_supported" }),
    );
  });

  test.each(PROTO_NAMES)("a `%s` LABEL resolves to no encryption", (name) => {
    expect(() => coseLabelToEnc(name as never)).toThrow(
      expect.objectContaining({ code: "cose_encryption_not_supported" }),
    );
  });

  test("tag length follows the algorithm (GCM/CCM-128 = 16, CCM-64 = 8, CBC-HS = key size)", () => {
    expect(tagBytesForEncryption("A256GCM")).toBe(16);
    expect(tagBytesForEncryption("AES-CCM-16-128-256")).toBe(16);
    expect(tagBytesForEncryption("AES-CCM-16-64-128")).toBe(8);
    expect(tagBytesForEncryption("AES-CCM-64-64-256")).toBe(8);
    expect(tagBytesForEncryption("A128CBC-HS256")).toBe(16);
    expect(tagBytesForEncryption("A192CBC-HS384")).toBe(24);
    expect(tagBytesForEncryption("A256CBC-HS512")).toBe(32);
  });
});
