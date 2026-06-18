import { describe, expect, test } from "vitest";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromDerive } from "../../../types/index.js";
import { getOctSize } from "../oct/get-size.js";
import { createDerFromDerive } from "./der-from-derive.js";

const base = {
  id: "key_test",
  type: "oct" as const,
  use: "enc" as const,
};

describe("createDerFromDerive", () => {
  test("should derive a key of exactly the required size", () => {
    const options = {
      ...base,
      algorithm: "A256KW",
      deriveFrom: "correct horse battery staple",
    } as KryptosFromDerive;

    const result = createDerFromDerive(options);

    expect(result.privateKey!.length).toBe(getOctSize(options));
    expect(result.privateKey!.length).toBe(32);
  });

  test("should be deterministic for the same passphrase and algorithm", () => {
    const options = {
      ...base,
      algorithm: "A256KW",
      deriveFrom: "correct horse battery staple",
    } as KryptosFromDerive;

    const a = createDerFromDerive(options);
    const b = createDerFromDerive(options);

    expect(a.privateKey).toEqual(b.privateKey);
  });

  test("should produce different keys for different algorithms (domain separation)", () => {
    const deriveFrom = "correct horse battery staple";

    const a = createDerFromDerive({
      ...base,
      algorithm: "A128KW",
      deriveFrom,
    } as KryptosFromDerive);

    const b = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom,
    } as KryptosFromDerive);

    // Different size already differs; compare the shared prefix to prove the
    // derivation itself diverges rather than merely being truncated.
    expect(a.privateKey!.equals(b.privateKey!.subarray(0, a.privateKey!.length))).toBe(
      false,
    );
  });

  test("should accept a passphrase of any length", () => {
    for (const deriveFrom of [
      "a",
      "a much longer passphrase that exceeds the key size",
    ]) {
      const result = createDerFromDerive({
        ...base,
        algorithm: "A256KW",
        deriveFrom,
      } as KryptosFromDerive);

      expect(result.privateKey!.length).toBe(32);
    }
  });

  test("should throw when no passphrase is provided", () => {
    const options = {
      ...base,
      algorithm: "A256KW",
    } as KryptosFromDerive;

    expect(() => createDerFromDerive(options)).toThrow(KryptosError);
  });

  test("should throw for a non-oct key type", () => {
    const options = {
      ...base,
      type: "RSA",
      algorithm: "A256KW",
      deriveFrom: "passphrase",
    } as unknown as KryptosFromDerive;

    expect(() => createDerFromDerive(options)).toThrow(KryptosError);
  });
});
