import MockDate from "mockdate";
import {
  TEST_X509_ALT_INTERMEDIATE_PEM,
  TEST_X509_ALT_ROOT_PEM,
  TEST_X509_BAD_INTERMEDIATE_PEM,
  TEST_X509_EXPIRED_PEM,
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509.js";
import { KryptosKit } from "../../../classes/index.js";
import type { IKryptos } from "../../../interfaces/index.js";
import { parseX509 } from "./parse-x509.js";
import { verifyX509Chain } from "./verify-chain.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("verifyX509Chain", () => {
  beforeAll(() => {
    // Pin clock to a date inside the fixture chain validity window
    // (fixture certs: 2026-04-13 to 2126-03-20).
    MockDate.set(new Date("2030-06-15T12:00:00.000Z").toISOString());
  });

  afterAll(() => {
    MockDate.reset();
  });

  test("accepts a valid leaf -> intermediate -> root chain anchored at root", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).not.toThrow();
  });

  test("accepts a chain that ends one level below the trust anchor", () => {
    const chain = parseX509([TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).not.toThrow();
  });

  test("throws when the signature link in the chain is broken", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_ALT_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /Signature verification failed/,
    );
  });

  test("throws when an expired certificate is in the chain", () => {
    const chain = parseX509([TEST_X509_EXPIRED_PEM, TEST_X509_ROOT_PEM]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /outside its validity window/,
    );
  });

  test("throws when a non-leaf certificate is not marked as a CA", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_BAD_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /not marked as a CA/,
    );
  });

  test("throws when the chain does not match any trust anchor", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ALT_ROOT_PEM)).toThrow(
      /does not match any trust anchor/,
    );
  });

  // RFC 5280 §6.1.4 / §4.2.1.3 hardening, exercised with freshly-minted chains
  // (fixture certs above sit inside the pinned 2030 validity window).
  describe("RFC 5280 §6.1.4 path-length and CA hardening", () => {
    const NB = new Date("2026-01-01T00:00:00Z");
    const toDer = (b64: string): Buffer => Buffer.from(b64, "base64");

    const root = (pathLen?: number): IKryptos =>
      KryptosKit.generate.auto({
        algorithm: "ES384",
        notBefore: NB,
        expiresAt: new Date("2046-01-01T00:00:00Z"),
        certificate: {
          mode: "root-ca",
          subject: "Root",
          ...(pathLen !== undefined ? { pathLengthConstraint: pathLen } : {}),
        },
      });

    test("accepts a valid three-tier root(pathLen=1) → intermediate(pathLen=0) → leaf", () => {
      const r = root(1);
      const intermediate = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2040-01-01T00:00:00Z"),
        certificate: {
          mode: "intermediate-ca",
          ca: r,
          subject: "Int",
          pathLengthConstraint: 0,
        },
      });
      const leaf = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2036-01-01T00:00:00Z"),
        certificate: { mode: "ca-signed", ca: intermediate, subject: "leaf" },
      });

      expect(() =>
        verifyX509Chain(leaf.certificateChain.map(toDer), r.certificateChain[0]),
      ).not.toThrow();
    });

    test("rejects a chain whose depth exceeds a CA pathLenConstraint", () => {
      // root pathLen=1 but two (unconstrained) intermediates below it: minting
      // succeeds, path validation must reject (§6.1.4).
      const r = root(1);
      const int1 = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2040-01-01T00:00:00Z"),
        certificate: { mode: "intermediate-ca", ca: r, subject: "Int1" },
      });
      const int2 = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2038-01-01T00:00:00Z"),
        certificate: { mode: "intermediate-ca", ca: int1, subject: "Int2" },
      });
      const leaf = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2036-01-01T00:00:00Z"),
        certificate: { mode: "ca-signed", ca: int2, subject: "leaf" },
      });

      expect(() =>
        verifyX509Chain(leaf.certificateChain.map(toDer), r.certificateChain[0]),
      ).toThrow(/path length constraint exceeded/i);
    });

    test("rejects a hand-built chain with a non-CA in a non-leaf position", () => {
      const r = root(1);
      const leaf = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2036-01-01T00:00:00Z"),
        certificate: { mode: "ca-signed", ca: r, subject: "leaf" },
      });
      const endEntity = KryptosKit.generate.auto({
        algorithm: "ES256",
        notBefore: NB,
        expiresAt: new Date("2046-01-01T00:00:00Z"),
        certificate: { mode: "self-signed", subject: "EE" },
      });

      const badChain = [
        leaf.certificateChain[0],
        endEntity.certificateChain[0], // cA=false, cannot be an issuer
        r.certificateChain[0],
      ].map(toDer);

      expect(() => verifyX509Chain(badChain, r.certificateChain[0])).toThrow(
        /not marked as a CA/i,
      );
    });
  });
});
