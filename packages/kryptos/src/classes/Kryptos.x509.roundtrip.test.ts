import MockDate from "mockdate";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_B64_DER,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_OTHER_PRIVATE_KEY_B64,
  TEST_X509_OTHER_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../__fixtures__/x509.js";
import { KryptosError } from "../errors/index.js";
import { Kryptos } from "./Kryptos.js";
import { KryptosKit } from "./KryptosKit.js";
import { describe, expect, test } from "vitest";

MockDate.set(new Date("2025-06-15T12:00:00.000Z").toISOString());

describe("Kryptos (X.509 round-trip)", () => {
  const fixedDates = {
    id: "3b9a051f-e1ec-562b-bf92-7cf92ec465ba",
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    notBefore: new Date("2020-01-01T00:00:00.000Z"),
  };

  const baseEcOptions = {
    ...fixedDates,
    algorithm: "ES256" as const,
    curve: "P-256" as const,
    type: "EC" as const,
    use: "sig" as const,
    internal: true,
    privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
    publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
  };

  const buildKryptosWithChain = (): Kryptos =>
    new Kryptos({
      ...baseEcOptions,
      certificateChain: [
        TEST_X509_LEAF_PEM,
        TEST_X509_INTERMEDIATE_PEM,
        TEST_X509_ROOT_PEM,
      ],
    });

  describe("toDB → fromDb round-trip", () => {
    test("preserves certificateChain", () => {
      const kryptos = buildKryptosWithChain();
      const db = kryptos.toDB();

      expect(db).toMatchSnapshot();

      const restored = KryptosKit.from.db(db as any);

      // The chain length is asserted first: `toEqual` between two `null`s holds,
      // so without it this block would stay green if the fixture ever stopped
      // attaching a chain. `?.` not `!` — a missing chain should fail this
      // assertion, not throw a null-deref before any assertion runs.
      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(restored.certificate("b64")).toEqual(kryptos.certificate("b64"));
    });

    test("chain-less kryptos round-trips certificateChain as empty array", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const db = kryptos.toDB();

      expect(db.certificateChain).toEqual([]);

      const restored = KryptosKit.from.db(db as any);
      expect(restored.certificate("b64")).toBeNull();
    });
  });

  describe("toJSON → fromJwk round-trip", () => {
    test("preserves certificateChain via toJWK", () => {
      const kryptos = buildKryptosWithChain();
      const json = kryptos.toJSON();

      expect(json).toMatchSnapshot();
      expect(json.certificateChain).toHaveLength(3);
    });

    test("chain-less kryptos produces empty certificateChain in toJSON", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const json = kryptos.toJSON();

      expect(json.certificateChain).toEqual([]);
      expect(json.certificateThumbprint).toBeNull();
    });
  });

  describe("toJWK → fromJwk round-trip", () => {
    test("preserves chain via JWK x5c/x5t#S256", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");

      expect(jwk).toMatchSnapshot();

      const restored = KryptosKit.from.jwk(jwk);
      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(restored.certificate("b64")).toEqual(kryptos.certificate("b64"));
    });

    test("benign: fromJwk with only x5c (no thumbprint) succeeds", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");
      const { "x5t#S256": x5tS256, ...stripped } = jwk;
      void x5tS256;

      const restored = KryptosKit.from.jwk(stripped);

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(restored.certificate("b64")).toEqual(kryptos.certificate("b64"));
    });

    // Now the only guard on this round trip, since `toJWK` emits `x5t`: an
    // incoming one is neither rejected nor believed. Both digests are recomputed
    // from `x5c`, so a planted value reaches neither of them.
    test("neither rejects nor trusts a legacy x5t (SHA-1) on input", () => {
      const kryptos = buildKryptosWithChain();
      const jwk = kryptos.toJWK("public");
      const planted = "AAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const withLegacyX5t = { ...(jwk as Record<string, unknown>), x5t: planted };

      const restored = KryptosKit.from.jwk(withLegacyX5t as any);

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(restored.certificate("b64")?.chain).toHaveLength(3);

      const source = kryptos.certificate("b64")!;
      const round = restored.certificate("b64")!;

      expect(round.thumbprint).toBe(source.thumbprint);
      expect(round.thumbprintSha1).toBe(source.thumbprintSha1);
      expect(round.thumbprintSha1).not.toBe(planted);
    });
  });

  describe("KryptosKit.clone", () => {
    test("preserves certificateChain", () => {
      const kryptos = buildKryptosWithChain();
      const cloned = KryptosKit.clone(kryptos);

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(cloned.certificate("b64")).toEqual(kryptos.certificate("b64"));
    });
  });

  describe("corruption", () => {
    test("fromDb with mismatched chain throws (leaf does not match key)", () => {
      const otherKryptos = new Kryptos({
        ...baseEcOptions,
        privateKey: Buffer.from(TEST_X509_OTHER_PRIVATE_KEY_B64, "base64url"),
        publicKey: Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url"),
      });
      const db = otherKryptos.toDB();
      const tampered = {
        ...db,
        certificateChain: [
          Buffer.from(TEST_X509_LEAF_B64_DER, "base64").toString("base64"),
        ],
      };

      expect(() => KryptosKit.from.db(tampered as any)).toThrow(KryptosError);
    });
  });
});
