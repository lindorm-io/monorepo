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
} from "../__fixtures__/x509";
import { KryptosError } from "../errors";
import { Kryptos } from "./Kryptos";
import { describe, expect, test, vi } from "vitest";

vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn().mockReturnValue("6e6f84b0-e125-5e3f-90ae-c65269668d98"),
}));

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
    isExternal: false,
    operations: ["sign", "verify"] as Array<"sign" | "verify">,
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

      expect(kryptos.certificateChain).toMatchSnapshot();
      expect(kryptos.certificateThumbprint).toMatchSnapshot();
      expect(kryptos.certificateChain).toHaveLength(3);
      expect(kryptos.hasCertificate).toBe(true);
      expect(kryptos.certificate).not.toBeNull();
    });

    test("accepts a chain in base64-DER form (no PEM wrapper)", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: TEST_X509_LEAF_B64_DER,
      });

      expect(kryptos.certificateChain).toHaveLength(1);
      expect(kryptos.certificateThumbprint).toMatchSnapshot();
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
    test("emits x5c / x5t#S256 when chain is set", () => {
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

    test("does not emit x5c / x5t#S256 when no chain is set", () => {
      const kryptos = new Kryptos(baseEcOptions);
      const jwk = kryptos.toJWK("public");

      expect(jwk.x5c).toBeUndefined();
      expect(jwk["x5t#S256"]).toBeUndefined();
    });

    test("does not emit legacy x5t (SHA-1) when chain is set", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [TEST_X509_LEAF_PEM],
      });

      const jwk = kryptos.toJWK("public") as Record<string, unknown>;

      expect(jwk.x5t).toBeUndefined();
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

  describe("hasCertificate / certificate", () => {
    test("hasCertificate false and certificate null when no chain", () => {
      const kryptos = new Kryptos(baseEcOptions);

      expect(kryptos.hasCertificate).toBe(false);
      expect(kryptos.certificate).toBeNull();
    });

    test("certificate is lazily parsed and memoized across accesses", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

      const first = kryptos.certificate;
      const second = kryptos.certificate;

      expect(first).not.toBeNull();
      expect(first).toBe(second);
    });

    test("certificate returns the leaf (first DER) only", () => {
      const kryptos = new Kryptos({
        ...baseEcOptions,
        certificateChain: [
          TEST_X509_LEAF_PEM,
          TEST_X509_INTERMEDIATE_PEM,
          TEST_X509_ROOT_PEM,
        ],
      });

      expect(kryptos.certificate?.subject.commonName).toBe("lindorm-test-leaf");
    });
  });

  describe("RSA public key matching", () => {
    const baseRsaOptions = {
      ...fixedDates,
      algorithm: "RS256" as const,
      curve: null,
      type: "RSA" as const,
      use: "sig" as const,
      isExternal: false,
      operations: ["sign", "verify"] as Array<"sign" | "verify">,
      privateKey: Buffer.from(TEST_X509_RSA_LEAF_PRIVATE_KEY_B64, "base64url"),
      publicKey: Buffer.from(TEST_X509_RSA_LEAF_PUBLIC_KEY_B64, "base64url"),
    };

    test("accepts an RSA cert chain whose leaf matches the RSA kryptos key", () => {
      const kryptos = new Kryptos({
        ...baseRsaOptions,
        certificateChain: [TEST_X509_RSA_LEAF_PEM],
      });

      expect(kryptos.certificateChain).toHaveLength(1);
      expect(kryptos.certificateThumbprint).toBeDefined();
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
