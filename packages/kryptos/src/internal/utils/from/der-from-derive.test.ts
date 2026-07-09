import { describe, expect, test } from "vitest";
import { KryptosKit } from "../../../classes/index.js";
import { KryptosError } from "../../../errors/index.js";
import type { IKryptos } from "../../../interfaces/index.js";
import type { KryptosFromDerive } from "../../../types/index.js";
import { KRYPTOS_BRAND } from "../../constants/brand.js";
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

  // Locks the legacy passphrase derivation byte-for-byte: HKDF-SHA256, utf8 IKM,
  // empty salt, info "lindorm:oct:<algorithm>". @lindorm/aegis depends on this.
  test("should keep the legacy passphrase derivation byte-identical", () => {
    const cases: Array<[string, string]> = [
      ["A256KW", "4e99911a6ab802c02f29ff0eb1c76ec6b8b742a8d25cc2440f6fd4f7fa6be30e"],
      ["A128KW", "57d6644531011aae9b414946b8c13b20"],
      [
        "HS256",
        "aa61b6e8e53ee9cdcf15a9c2bae69f431b7b8d0b72da17ec0f7e1eaced111729" +
          "c679cda3a2a18a69d89982a084e28c0256cb911e6fbf008dda9523c84f52cca3",
      ],
    ];

    for (const [algorithm, expected] of cases) {
      const result = createDerFromDerive({
        ...base,
        algorithm,
        deriveFrom: "correct horse battery staple",
      } as KryptosFromDerive);

      expect(result.privateKey!.toString("hex")).toBe(expected);
    }
  });

  // A path must not change the legacy (no-path) derivation.
  test("should be unaffected by omitting the path (legacy info preserved)", () => {
    const legacy = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: "correct horse battery staple",
    } as KryptosFromDerive);

    expect(legacy.privateKey!.toString("hex")).toBe(
      "4e99911a6ab802c02f29ff0eb1c76ec6b8b742a8d25cc2440f6fd4f7fa6be30e",
    );
  });

  test("should bind the path into HKDF info and stay deterministic", () => {
    const withPath = (path: string) =>
      createDerFromDerive({
        ...base,
        algorithm: "A256KW",
        deriveFrom: "correct horse battery staple",
        path,
      } as KryptosFromDerive);

    // Same path → identical bytes.
    expect(withPath("urn:lindorm:tyr:kek:v1").privateKey).toEqual(
      withPath("urn:lindorm:tyr:kek:v1").privateKey,
    );

    // A path diverges from the legacy (no-path) derivation.
    const legacy = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: "correct horse battery staple",
    } as KryptosFromDerive);
    expect(withPath("urn:lindorm:tyr:kek:v1").privateKey).not.toEqual(legacy.privateKey);

    // A different path → different key (rotation by version bump).
    expect(withPath("urn:lindorm:tyr:kek:v1").privateKey).not.toEqual(
      withPath("urn:lindorm:tyr:kek:v2").privateKey,
    );
  });

  test("should bind the algorithm into the path-scoped info", () => {
    const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
    const path = "urn:lindorm:tyr:kek:v1";

    // Same seed + path but different algorithm → different key material,
    // proving the algorithm is bound into the info even with a path.
    const a = createDerFromDerive({
      ...base,
      algorithm: "A128KW",
      deriveFrom: seed,
      path,
    } as KryptosFromDerive);
    const b = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: seed,
      path,
    } as KryptosFromDerive);

    expect(a.privateKey!.equals(b.privateKey!.subarray(0, a.privateKey!.length))).toBe(
      false,
    );
  });

  test("should derive deterministically from an oct seed key (IKryptos)", () => {
    const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

    const a = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: seed,
      path: "urn:lindorm:tyr:kek:v1",
    } as KryptosFromDerive);
    const b = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: seed,
      path: "urn:lindorm:tyr:kek:v1",
    } as KryptosFromDerive);

    expect(a.privateKey!.length).toBe(32);
    expect(a.privateKey).toEqual(b.privateKey);
  });

  test("should use the seed's raw private bytes as IKM (not its utf8 form)", () => {
    const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
    const path = "urn:lindorm:tyr:kek:v1";

    const fromKey = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: seed,
      path,
    } as KryptosFromDerive);

    // Passing the seed's private bytes as a utf8 string would derive something
    // else entirely; the key path must feed raw bytes into HKDF.
    const secret = seed.export("der").privateKey!.toString("utf8");
    const fromString = createDerFromDerive({
      ...base,
      algorithm: "A256KW",
      deriveFrom: secret,
      path,
    } as KryptosFromDerive);

    expect(fromKey.privateKey).not.toEqual(fromString.privateKey);
  });

  test("should reject a non-oct seed key", () => {
    const seed = KryptosKit.generate.sig.ec({ algorithm: "ES256" });

    expect(() =>
      createDerFromDerive({
        ...base,
        algorithm: "A256KW",
        deriveFrom: seed,
        path: "urn:lindorm:tyr:kek:v1",
      } as unknown as KryptosFromDerive),
    ).toThrow(KryptosError);
  });

  // A valid oct Kryptos always carries its secret, so this guard is defensive.
  // Exercise it with a branded oct-typed value that reports no private material.
  test("should reject an oct seed key with no private material", () => {
    const seedless = {
      constructor: { [KRYPTOS_BRAND]: true },
      type: "oct",
      hasPrivateKey: false,
    } as unknown as IKryptos;

    expect(KryptosKit.isKryptos(seedless)).toBe(true);
    expect(() =>
      createDerFromDerive({
        ...base,
        algorithm: "A256KW",
        deriveFrom: seedless,
        path: "urn:lindorm:tyr:kek:v1",
      } as unknown as KryptosFromDerive),
    ).toThrow(KryptosError);
  });

  // The KEK id is embedded in every ciphertext, so re-derivation must reproduce
  // the id too — not just the key bytes. With a path and no explicit id, the id
  // is derived from the same HKDF stream.
  test("should derive the id deterministically from the path (no explicit id)", () => {
    const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
    const derive = (path: string, algorithm = "A256KW") =>
      createDerFromDerive({
        type: "oct",
        use: "enc",
        algorithm,
        deriveFrom: seed,
        path,
      } as KryptosFromDerive);

    const a = derive("urn:lindorm:tyr:kek:v1");
    const b = derive("urn:lindorm:tyr:kek:v1");

    // Same seed + path → identical id and key material.
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^key_[A-Za-z0-9]{16}$/);
    expect(a.privateKey).toEqual(b.privateKey);

    // A different path or algorithm → different id.
    expect(derive("urn:lindorm:tyr:kek:v2").id).not.toBe(a.id);
    expect(derive("urn:lindorm:tyr:kek:v1", "A128KW").id).not.toBe(a.id);
  });

  test("should let an explicit id override the derived id", () => {
    const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

    const result = createDerFromDerive({
      id: "key_explicit",
      type: "oct",
      use: "enc",
      algorithm: "A256KW",
      deriveFrom: seed,
      path: "urn:lindorm:tyr:kek:v1",
    } as KryptosFromDerive);

    expect(result.id).toBe("key_explicit");
  });

  // Legacy (no path, no id) keeps a fresh random id — unchanged behaviour — while
  // the key bytes still match the pre-change derivation.
  test("should keep a random id and legacy key bytes when no path is given", () => {
    const derive = () =>
      createDerFromDerive({
        type: "oct",
        use: "enc",
        algorithm: "A256KW",
        deriveFrom: "correct horse battery staple",
      } as KryptosFromDerive);

    const a = derive();
    const b = derive();

    expect(a.id).toMatch(/^key_/);
    expect(a.id).not.toBe(b.id);
    expect(a.privateKey!.toString("hex")).toBe(
      "4e99911a6ab802c02f29ff0eb1c76ec6b8b742a8d25cc2440f6fd4f7fa6be30e",
    );
  });
});
