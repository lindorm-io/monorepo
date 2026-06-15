import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import { coseLabelToEnc, encToCoseLabel, tagBytesForEncryption } from "./enc-labels.js";

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

  test("rejects an unsupported encryption / label", () => {
    expect(() => encToCoseLabel("A128CBC-HS256" as never)).toThrow(AegisError);
    expect(() => coseLabelToEnc(999)).toThrow(AegisError);
  });

  test("tag length follows the algorithm (GCM/CCM-128 = 16, CCM-64 = 8)", () => {
    expect(tagBytesForEncryption("A256GCM")).toBe(16);
    expect(tagBytesForEncryption("AES-CCM-16-128-256")).toBe(16);
    expect(tagBytesForEncryption("AES-CCM-16-64-128")).toBe(8);
    expect(tagBytesForEncryption("AES-CCM-64-64-256")).toBe(8);
  });
});
