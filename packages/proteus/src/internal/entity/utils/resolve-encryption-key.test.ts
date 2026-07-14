import { Amphora } from "@lindorm/amphora";
import { KryptosKit, type IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { resolveEncryptionKey } from "./resolve-encryption-key.js";
import { afterEach, describe, expect, test, vi } from "vitest";

const createEncKey = (purpose: string, publish = false): IKryptos =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: "https://test.proteus/",
    purpose,
    publish,
  });

const createAmphora = (...keys: Array<IKryptos>) => {
  const amphora = new Amphora({
    logger: createMockLogger(),
    domain: "https://test.lindorm.io",
  });
  for (const key of keys) amphora.add(key);
  return amphora;
};

const resolve = (encrypted: MetaEncrypted, amphora: Amphora) =>
  resolveEncryptionKey(encrypted, amphora, "secret", "TestEntity");

describe("resolveEncryptionKey", () => {
  describe("predicate", () => {
    // THE HAZARD. A pylon vault holds at least two internal encryption keys: the
    // KEK (minted once, at scaffold) and the `dir` cookie key (rotated yearly, so
    // almost always the newer of the two). An unscoped lookup takes "any internal
    // enc key, newest first" — i.e. the cookie key. The predicate is what pins it.
    test("should select the named key, not the newer internal enc key", () => {
      const kek = createEncKey("pylon:kek");
      const cookie = createEncKey("cookie");

      // Amphora sorts newest-first, so make the WRONG key the newer one.
      expect(cookie.createdAt.getTime()).toBeGreaterThanOrEqual(kek.createdAt.getTime());

      const amphora = createAmphora(kek, cookie);

      const resolved = resolve(
        { kryptos: null, predicate: { purpose: "pylon:kek" } },
        amphora,
      );

      expect(resolved.id).toBe(kek.id);
    });

    test("should select an unpublished key by default", () => {
      const kek = createEncKey("pylon:kek");
      const amphora = createAmphora(kek);

      // Amphora's own filter defaults to `publish: true` — without proteus's
      // `publish: false` default the KEK would be invisible.
      expect(
        resolve({ kryptos: null, predicate: { purpose: "pylon:kek" } }, amphora).id,
      ).toBe(kek.id);
    });

    test("should let the predicate override the publish default", () => {
      const published = createEncKey("shared", true);
      const amphora = createAmphora(published);

      expect(
        resolve(
          { kryptos: null, predicate: { purpose: "shared", publish: true } },
          amphora,
        ).id,
      ).toBe(published.id);
    });

    test("should throw when no key matches the predicate", () => {
      const amphora = createAmphora(createEncKey("cookie"));

      expect(() =>
        resolve({ kryptos: null, predicate: { purpose: "pylon:kek" } }, amphora),
      ).toThrow(ProteusError);
      expect(() =>
        resolve({ kryptos: null, predicate: { purpose: "pylon:kek" } }, amphora),
      ).toThrow('No encryption key matches field "secret" on entity "TestEntity"');
    });
  });

  describe("floor", () => {
    test("should never select a signing key", () => {
      const sig = KryptosKit.generate.sig.oct({
        algorithm: "HS256",
        issuer: "https://test.proteus/",
        purpose: "pylon:kek",
      });
      const amphora = createAmphora(sig);

      expect(() =>
        resolve({ kryptos: null, predicate: { purpose: "pylon:kek" } }, amphora),
      ).toThrow('No encryption key matches field "secret" on entity "TestEntity"');
    });

    // A public-only key (a recipient key from someone's JWKS) could encrypt a
    // column and then never open it again. A published predicate is the case that
    // needs the floor: `publish` is a DEFAULT, so a caller may set `publish: true`
    // and reach the published set — where remotely-fetched, public-only keys live.
    // Only `hasPrivateKey` stands between them and an unopenable column.
    test("should never select a public-only encryption key", () => {
      const asymmetric = KryptosKit.generate.enc.ec({
        algorithm: "ECDH-ES",
        curve: "P-256",
        issuer: "https://test.proteus/",
      });
      const publicOnly = KryptosKit.from.jwk(asymmetric.toJWK("public"));

      expect(publicOnly.hasPrivateKey).toBe(false);
      expect(publicOnly.publish).toBe(true);

      const amphora = createAmphora(publicOnly);

      // The predicate matches it on every attribute a consumer can express.
      expect(() =>
        resolve({ kryptos: null, predicate: { type: "EC", publish: true } }, amphora),
      ).toThrow('No encryption key matches field "secret" on entity "TestEntity"');
    });

    test("should apply the floor to an injected kryptos", () => {
      const sig = KryptosKit.generate.sig.oct({
        algorithm: "HS256",
        issuer: "https://test.proteus/",
      });
      const amphora = createAmphora(createEncKey("pylon:kek"));

      expect(() => resolve({ kryptos: sig, predicate: null }, amphora)).toThrow(
        ProteusError,
      );
      expect(() => resolve({ kryptos: sig, predicate: null }, amphora)).toThrow(
        'Encryption key for field "secret" on entity "TestEntity" violates the encryption floor',
      );
    });

    test("should apply the floor to an injected public-only kryptos", () => {
      const asymmetric = KryptosKit.generate.enc.ec({
        algorithm: "ECDH-ES",
        curve: "P-256",
        issuer: "https://test.proteus/",
      });
      const publicOnly = KryptosKit.from.jwk(asymmetric.toJWK("public"));
      const amphora = createAmphora();

      expect(() => resolve({ kryptos: publicOnly, predicate: null }, amphora)).toThrow(
        'Encryption key for field "secret" on entity "TestEntity" violates the encryption floor',
      );
    });
  });

  // The vault drops inactive keys from a QUERY, so the clock only bites where the
  // vault does not — and on the write side that is the INJECTED key: an env KEK
  // handed to `@Encrypted({ kryptos })` never touches the vault at all.
  describe("the time floor", () => {
    const detached = (notBefore: Date, expiresAt: Date): IKryptos =>
      KryptosKit.clone(createEncKey("env:kek"), { notBefore, expiresAt });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("should refuse to ENCRYPT with an injected key that has expired", () => {
      const expired = detached(new Date("2020-01-01"), new Date("2021-01-01"));

      expect(() =>
        resolve({ kryptos: expired, predicate: null }, createAmphora()),
      ).toThrow(
        'Encryption key for field "secret" on entity "TestEntity" violates the encryption floor',
      );
    });

    test("should refuse to ENCRYPT with an injected key that is not yet valid", () => {
      const pending = detached(new Date("2099-01-01"), new Date("2100-01-01"));

      expect(() =>
        resolve({ kryptos: pending, predicate: null }, createAmphora()),
      ).toThrow(
        'Encryption key for field "secret" on entity "TestEntity" violates the encryption floor',
      );
    });

    // `Amphora.add` refuses a key that is ALREADY expired, so the only way a vault
    // holds one is the way a deployment gets one: it was added while valid, and it
    // aged. The clock has to move for this to be honest.
    test("should not select a key that has expired while in the vault", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));

      const amphora = createAmphora(
        detached(
          new Date("2024-01-01T00:00:00.000Z"),
          new Date("2025-01-01T00:00:00.000Z"),
        ),
      );

      expect(
        resolve({ kryptos: null, predicate: { purpose: "env:kek" } }, amphora).purpose,
      ).toBe("env:kek");

      vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));

      expect(() =>
        resolve({ kryptos: null, predicate: { purpose: "env:kek" } }, amphora),
      ).toThrow('No encryption key matches field "secret" on entity "TestEntity"');
    });
  });

  describe("kryptos", () => {
    test("should return an injected key that satisfies the floor without touching the vault", () => {
      const injected = createEncKey("env:kek");
      const amphora = createAmphora();

      expect(resolve({ kryptos: injected, predicate: null }, amphora).id).toBe(
        injected.id,
      );
    });

    test("should prefer the injected key over the predicate", () => {
      const kek = createEncKey("pylon:kek");
      const injected = createEncKey("env:kek");
      const amphora = createAmphora(kek);

      expect(
        resolve({ kryptos: injected, predicate: { purpose: "pylon:kek" } }, amphora).id,
      ).toBe(injected.id);
    });
  });
});
