import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_B64_DER,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_OTHER_PRIVATE_KEY_B64,
  TEST_X509_OTHER_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
  TEST_X509_RSA_LEAF_PEM,
  TEST_X509_RSA_LEAF_PRIVATE_KEY_B64,
  TEST_X509_RSA_LEAF_PUBLIC_KEY_B64,
} from "../__fixtures__/x509.js";
import { B64 } from "@lindorm/b64";
import { KryptosError } from "../errors/index.js";
import { certDerToPem } from "../internal/utils/x509/der-to-pem.js";
import { parseX509 } from "../internal/utils/x509/parse-x509.js";
import { x5tS1, x5tS256 } from "../internal/utils/x509/x509-thumbprints.js";
import { Kryptos } from "./Kryptos.js";
import { describe, expect, test } from "vitest";

describe("Kryptos (X.509)", () => {
  const fixedDates = {
    id: "3b9a051f-e1ec-562b-bf92-7cf92ec465ba",
    createdAt: new Date("2026-04-13T12:00:00.000Z"),
    notBefore: new Date("2026-04-13T12:00:00.000Z"),
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

  describe("construction", () => {
    test("accepts a chain (PEM input) when leaf cert matches kryptos public key", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

      expect(kryptos.certificate("b64")?.chain).toMatchSnapshot();
      expect(kryptos.certificate("b64")?.thumbprint).toMatchSnapshot();
      expect(kryptos.certificate("b64")?.thumbprintSha1).toMatchSnapshot();
      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      expect(kryptos.hasCertificate).toBe(true);
      expect(kryptos.parseCertificate()).not.toBeNull();
    });

    test("the b64 thumbprintSha1 is the base64url SHA-1 of the leaf DER", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

      const [leaf] = parseX509(TEST_X509_LEAF_PEM);

      expect(kryptos.certificate("b64")?.thumbprintSha1).toBe(x5tS1(leaf));
    });

    test("every certificate format is null on a chain-less kryptos", () => {
      const kryptos = new Kryptos(baseEcOptions);

      expect(kryptos.certificate("b64")).toBeNull();
      expect(kryptos.certificate("der")).toBeNull();
      expect(kryptos.certificate("jwk")).toBeNull();
      expect(kryptos.certificate("pem")).toBeNull();
    });

    test("accepts a chain in base64-DER form (no PEM wrapper)", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: TEST_X509_LEAF_B64_DER,
      });

      expect(kryptos.certificate("b64")?.chain).toHaveLength(1);
      expect(kryptos.certificate("b64")?.thumbprint).toMatchSnapshot();
    });

    test("throws when leaf cert public key does not match kryptos public key", () => {
      expect(
        () =>
          new Kryptos({
            ...baseEcOptions,
            privateKey: Buffer.from(TEST_X509_OTHER_PRIVATE_KEY_B64, "base64url"),
            publicKey: Buffer.from(TEST_X509_OTHER_PUBLIC_KEY_B64, "base64url"),
            certificateChain: [TEST_X509_LEAF_PEM],
          }),
      ).toThrow(KryptosError);
    });
  });

  describe("toJWK", () => {
    test("emits x5c / x5t / x5t#S256 when chain is set", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

      const jwk = kryptos.toJWK("public");

      expect(jwk.x5c).toHaveLength(3);
      expect(jwk).toMatchSnapshot();
    });

    test("emits no x5c / x5t / x5t#S256 when no chain is set", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const jwk = kryptos.toJWK("public");

      expect(jwk.x5c).toBeUndefined();
      expect(jwk.x5t).toBeUndefined();
      expect(jwk["x5t#S256"]).toBeUndefined();
    });

    // A published JWK states the binding TWICE so a relying party that only knows
    // `x5t` (RFC 7517 §4.8, SHA-1) can still tie the key to its certificate.
    // BESIDE, never INSTEAD: `x5t#S256` is the digest we verify against, and a
    // JWK carrying only the SHA-1 one would push a relying party onto a broken
    // hash for the binding.
    test("publishes the SHA-1 x5t beside x5t#S256, never instead of it", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [TEST_X509_LEAF_PEM],
      });

      const jwk = kryptos.toJWK("public");
      const [leaf] = parseX509(TEST_X509_LEAF_PEM);

      expect(jwk["x5t#S256"]).toBe(x5tS256(leaf));
      expect(jwk.x5t).toBe(x5tS1(leaf));
    });
  });

  describe("verifyCertificate", () => {
    test("succeeds against a correct trust anchor", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM],
      });

      expect(() =>
        kryptos.verifyCertificate({ trustAnchors: TEST_X509_ROOT_PEM }),
      ).not.toThrow();
    });

    test("throws when no chain is set", () => {
      const kryptos = new Kryptos(baseEcOptions);

      expect(() =>
        kryptos.verifyCertificate({ trustAnchors: TEST_X509_ROOT_PEM }),
      ).toThrow("Kryptos has no certificate to verify");
    });
  });

  describe("hasCertificate / parseCertificate", () => {
    const chained = () =>
      new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

    test("hasCertificate false and parseCertificate null when no chain", () => {
      const kryptos = new Kryptos(baseEcOptions);

      expect(kryptos.hasCertificate).toBe(false);
      expect(kryptos.parseCertificate()).toBeNull();
    });

    test("each index is lazily parsed and memoized across accesses", () => {
      const kryptos = chained();

      const first = kryptos.parseCertificate();
      const second = kryptos.parseCertificate();

      expect(first).not.toBeNull();
      expect(first).toBe(second);

      const firstRoot = kryptos.parseCertificate(2);
      const secondRoot = kryptos.parseCertificate(2);

      expect(firstRoot).not.toBeNull();
      expect(firstRoot).toBe(secondRoot);
      expect(firstRoot).not.toBe(first);
    });

    test("defaults to the leaf (index 0)", () => {
      const kryptos = chained();

      expect(kryptos.parseCertificate()?.subject.commonName).toBe("lindorm-test-leaf");
      expect(kryptos.parseCertificate(0)).toBe(kryptos.parseCertificate());
    });

    test("walks the chain by index", () => {
      const kryptos = chained();

      expect(kryptos.parseCertificate(1)?.subject.commonName).toBe(
        "lindorm-test-intermediate",
      );
      expect(kryptos.parseCertificate(2)?.subject.commonName).toBe("lindorm-test-root");
    });

    test("returns null for any index that is not a position in the chain", () => {
      const kryptos = chained();

      expect(kryptos.parseCertificate(3)).toBeNull();
      expect(kryptos.parseCertificate(-1)).toBeNull();
      expect(kryptos.parseCertificate(Infinity)).toBeNull();
      expect(kryptos.parseCertificate(-Infinity)).toBeNull();
      // A fractional or NaN index is BETWEEN the range checks: it is neither
      // negative nor past the end, so without the integer guard it indexes an
      // empty slot and the parser throws a raw TypeError.
      expect(kryptos.parseCertificate(1.5)).toBeNull();
      expect(kryptos.parseCertificate(NaN)).toBeNull();
    });
  });

  describe("certificate(format)", () => {
    const chained = () =>
      new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

    test("b64 chain is standard base64 and the digests are base64url", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      const b64 = kryptos.certificate("b64")!;

      expect(b64.chain.every((entry) => B64.isBase64(entry))).toBe(true);
      expect(B64.isBase64Url(b64.thumbprint)).toBe(true);
      expect(B64.isBase64Url(b64.thumbprintSha1)).toBe(true);
    });

    test("der chain is the raw DER the b64 chain encodes", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      const b64 = kryptos.certificate("b64")!;
      const der = kryptos.certificate("der")!;

      expect(der.chain.map((entry) => entry.toString("base64"))).toEqual(b64.chain);
      expect(der.thumbprint.toString("base64url")).toBe(b64.thumbprint);
      expect(der.thumbprintSha1.toString("base64url")).toBe(b64.thumbprintSha1);
      expect(der.thumbprint).toHaveLength(32);
      expect(der.thumbprintSha1).toHaveLength(20);
    });

    test("der hands out copies, never the instance's own buffers", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      const first = kryptos.certificate("der")!.chain[0];
      first.fill(0);

      expect(kryptos.certificate("der")!.chain[0].equals(first)).toBe(false);
    });

    test("jwk spells the same three facts with RFC 7517 member names", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      const b64 = kryptos.certificate("b64")!;
      const jwk = kryptos.certificate("jwk")!;

      expect(jwk.x5c).toEqual(b64.chain);
      expect(jwk["x5t#S256"]).toBe(b64.thumbprint);
      expect(jwk.x5t).toBe(b64.thumbprintSha1);
    });

    test("pem wraps every b64 chain entry in a CERTIFICATE block", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      const pem = kryptos.certificate("pem")!;

      expect(pem.chain).toHaveLength(3);
      expect(pem.chain[0]).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
      expect(pem.chain[0]).toMatch(/\n-----END CERTIFICATE-----$/);
      expect(pem.chain).toEqual(kryptos.certificate("b64")!.chain.map(certDerToPem));
    });

    // Each spelling is checked on its OWN array. A length assertion after
    // mutating one of them proves neither: the cached array is frozen, so the
    // mutation throws before any assertion runs, and one branch copying out
    // satisfies a length check made through the other.
    test("b64 hands out a fresh, mutable array on every call", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      const first = kryptos.certificate("b64")!.chain;
      const second = kryptos.certificate("b64")!.chain;

      expect(first).not.toBe(second);
      expect(Object.isFrozen(first)).toBe(false);
      expect(first).toEqual(second);
    });

    test("jwk hands out a fresh, mutable array on every call", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      const first = kryptos.certificate("jwk")!.x5c;
      const second = kryptos.certificate("jwk")!.x5c;

      expect(first).not.toBe(second);
      expect(Object.isFrozen(first)).toBe(false);
      expect(first).toEqual(second);
    });

    test("pem hands out a fresh array on every call", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      expect(kryptos.certificate("pem")!.chain).not.toBe(
        kryptos.certificate("pem")!.chain,
      );
    });

    test("throws on an unsupported format, chain or no chain", () => {
      expect(() => chained().certificate("x509" as "b64")).toThrow(KryptosError);
      expect(() => new Kryptos(baseEcOptions).certificate("x509" as "b64")).toThrow(
        KryptosError,
      );
    });
  });

  // These rows pin that every export AGREES with `certificate()`. They cannot
  // detect a second derivation that happens to spell the chain identically —
  // single-derivation is a property of `certificateSource`, not of this suite.
  describe("every export states the same certificate", () => {
    const chained = () =>
      new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

    test("toDB, toJSON, toJWK and export(pem) all state what certificate() states", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);
      const b64 = kryptos.certificate("b64")!;
      const jwk = kryptos.certificate("jwk")!;
      const pem = kryptos.certificate("pem")!;

      expect(kryptos.toDB().certificateChain).toEqual(b64.chain);

      const json = kryptos.toJSON();
      expect(json.certificateChain).toEqual(b64.chain);
      expect(json.certificateThumbprint).toBe(b64.thumbprint);
      expect(kryptos.certificateThumbprint).toBe(b64.thumbprint);

      const exported = kryptos.toJWK("public");
      expect(exported.x5c).toEqual(jwk.x5c);
      expect(exported.x5t).toBe(jwk.x5t);
      expect(exported["x5t#S256"]).toBe(jwk["x5t#S256"]);

      const exportedPem = kryptos.export("pem");
      expect(exportedPem.certificate).toBe(pem.chain[0]);
      expect(exportedPem.certificateChain).toEqual(pem.chain);
    });

    // The SHA-1 digest is certificate MATERIAL, not queryable metadata: it rides
    // `certificate(format)` in every spelling, and appears in no serialized shape.
    test("the SHA-1 digest is material only — never metadata", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      expect(kryptos.certificate("b64")!.thumbprintSha1).toEqual(expect.any(String));
      expect(kryptos.certificate("jwk")!.x5t).toEqual(expect.any(String));
      expect(kryptos.certificate("der")!.thumbprintSha1).toHaveLength(20);

      expect(kryptos.toJSON()).not.toHaveProperty("certificateThumbprintSha1");
      expect(kryptos.toDB()).not.toHaveProperty("certificateThumbprintSha1");
      expect(kryptos).not.toHaveProperty("certificateThumbprintSha1");
    });

    // A query runs against INSTANCES, so the lookup key has to be readable off
    // one. The chain is not: it is material, and `certificate(format)` is its door.
    test("the thumbprint is queryable on the instance; the chain is not", () => {
      const kryptos = chained();

      expect(kryptos.certificate("b64")?.chain).toHaveLength(3);

      expect(kryptos.certificateThumbprint).toBe(kryptos.certificate("b64")!.thumbprint);
      expect(kryptos.hasCertificate).toBe(true);
      expect(kryptos).not.toHaveProperty("certificateChain");
    });

    test("a chain-less key states absence the same way everywhere", () => {
      const kryptos = new Kryptos(baseEcOptions);

      expect(kryptos.toDB().certificateChain).toEqual([]);
      expect(kryptos.toJSON().certificateChain).toEqual([]);
      expect(kryptos.toJSON().certificateThumbprint).toBeNull();
      expect(kryptos.certificateThumbprint).toBeNull();
      expect(kryptos.export("pem").certificate).toBeUndefined();
      expect(kryptos.export("pem").certificateChain).toBeUndefined();
    });
  });

  describe("RSA public key matching", () => {
    const baseRsaOptions = {
      ...fixedDates,
      algorithm: "RS256" as const,
      curve: null,
      type: "RSA" as const,
      use: "sig" as const,
      internal: true,
      privateKey: Buffer.from(TEST_X509_RSA_LEAF_PRIVATE_KEY_B64, "base64url"),
      publicKey: Buffer.from(TEST_X509_RSA_LEAF_PUBLIC_KEY_B64, "base64url"),
    };

    test("accepts an RSA cert chain whose leaf matches the RSA kryptos key", () => {
      const kryptos = new Kryptos({
        ...baseRsaOptions,
        certificateChain: [TEST_X509_RSA_LEAF_PEM],
      });

      expect(kryptos.certificate("b64")?.chain).toHaveLength(1);
      expect(kryptos.certificate("b64")?.thumbprint).toBeDefined();
    });

    test("rejects an RSA cert chain whose leaf does not match the RSA kryptos key", () => {
      expect(
        () =>
          new Kryptos({
            ...baseRsaOptions,
            certificateChain: [TEST_X509_LEAF_PEM],
          }),
      ).toThrow("leaf certificate public key does not match kryptos public key");
    });
  });
});
