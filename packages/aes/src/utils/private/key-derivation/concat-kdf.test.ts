import { concatKdf } from "./concat-kdf";

describe("concatKdf", () => {
  const sharedSecret = Buffer.from("shared-secret-value-for-testing!");

  test("should derive a key with the correct length", () => {
    const result = concatKdf({
      algorithm: "A256GCM",
      keyLength: 32,
      sharedSecret,
    });

    expect(result).toEqual({ derivedKey: expect.any(Buffer) });
    expect(result.derivedKey).toHaveLength(32);
  });

  test("should derive a 16-byte key", () => {
    const result = concatKdf({
      algorithm: "A128GCM",
      keyLength: 16,
      sharedSecret,
    });

    expect(result.derivedKey).toHaveLength(16);
  });

  test("should derive a 24-byte key", () => {
    const result = concatKdf({
      algorithm: "A192GCM",
      keyLength: 24,
      sharedSecret,
    });

    expect(result.derivedKey).toHaveLength(24);
  });

  test("should produce deterministic output for the same inputs", () => {
    const opts = {
      algorithm: "A256GCM" as const,
      keyLength: 32 as const,
      sharedSecret,
    };

    const a = concatKdf(opts);
    const b = concatKdf(opts);

    expect(a.derivedKey).toEqual(b.derivedKey);
  });

  test("should produce different keys for different algorithms", () => {
    const a = concatKdf({ algorithm: "A128GCM", keyLength: 16, sharedSecret });
    const b = concatKdf({ algorithm: "A256GCM", keyLength: 16, sharedSecret });

    expect(a.derivedKey).not.toEqual(b.derivedKey);
  });

  test("should produce different keys for different shared secrets", () => {
    const a = concatKdf({
      algorithm: "A256GCM",
      keyLength: 32,
      sharedSecret: Buffer.from("secret-a"),
    });
    const b = concatKdf({
      algorithm: "A256GCM",
      keyLength: 32,
      sharedSecret: Buffer.from("secret-b"),
    });

    expect(a.derivedKey).not.toEqual(b.derivedKey);
  });

  test("should incorporate apu into the derivation", () => {
    const base = { algorithm: "A256GCM", keyLength: 32 as const, sharedSecret };
    const a = concatKdf({ ...base, apu: Buffer.from("alice") });
    const b = concatKdf({ ...base, apu: Buffer.from("bob") });
    const c = concatKdf(base);

    expect(a.derivedKey).not.toEqual(b.derivedKey);
    expect(a.derivedKey).not.toEqual(c.derivedKey);
  });

  test("should incorporate apv into the derivation", () => {
    const base = { algorithm: "A256GCM", keyLength: 32 as const, sharedSecret };
    const a = concatKdf({ ...base, apv: Buffer.from("alice") });
    const b = concatKdf({ ...base, apv: Buffer.from("bob") });
    const c = concatKdf(base);

    expect(a.derivedKey).not.toEqual(b.derivedKey);
    expect(a.derivedKey).not.toEqual(c.derivedKey);
  });
});
