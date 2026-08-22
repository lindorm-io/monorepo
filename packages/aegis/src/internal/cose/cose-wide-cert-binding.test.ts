import { Kryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import {
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_LEAF_PRIVATE_KEY_B64,
  TEST_X509_LEAF_PUBLIC_KEY_B64,
  TEST_X509_ROOT_PEM,
} from "../../__fixtures__/x509.js";
import type { CoseLabel } from "./cose-label.js";
import { resolveWideCertBinding } from "./cose-wide-cert-binding.js";

MockDate.set(new Date("2026-06-01T12:00:00.000Z"));

const defaults = {
  notBefore: new Date("2020-01-01T00:00:00.000Z"),
  expiresAt: new Date("2120-01-01T00:00:00.000Z"),
  createdAt: new Date("2020-01-01T00:00:00.000Z"),
  updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  issuer: "https://test.lindorm.io/",
  algorithm: "ES256" as const,
  curve: "P-256" as const,
  type: "EC" as const,
  use: "sig" as const,
  privateKey: Buffer.from(TEST_X509_LEAF_PRIVATE_KEY_B64, "base64url"),
  publicKey: Buffer.from(TEST_X509_LEAF_PUBLIC_KEY_B64, "base64url"),
};

const CERT_KEY = new Kryptos({
  ...defaults,
  id: "a1b2c3d4-0000-0000-0000-aegis-wide-cert",
  certificateChain: [TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM, TEST_X509_ROOT_PEM],
});

const CHAINLESS = new Kryptos({
  ...defaults,
  id: "e5f6a7b8-0000-0000-0000-aegis-wide-none",
});

const LEAF = CERT_KEY.certificate("der")!.chain[0];

const bucket = (value: unknown): Map<CoseLabel, unknown> => new Map([[34, value]]);

const digest = (b64u: string): Buffer => Buffer.from(b64u, "base64url");

/**
 * THE VERDICT THE COSE READ PATH HANDS THE MODE POLICY. A conformant issuer may
 * bind with a hash JOSE has no parameter for (RFC 9360 §2, RFC 7515 §4.1.7,
 * RFC 7515 §4.1.8), so this function — which holds the wire AND the key — makes the
 * comparison and `verifyCertBinding` stays wire-agnostic.
 */
describe("resolveWideCertBinding", () => {
  test.each([
    [-43, "SHA-384", ShaKit.S384(LEAF)],
    [-44, "SHA-512", ShaKit.S512(LEAF)],
  ] as const)("matches a %s (%s) digest of our own leaf", (label, name, computed) => {
    expect(
      resolveWideCertBinding(bucket([label, digest(computed)]), CERT_KEY),
    ).toStrictEqual({
      algorithm: name,
      matches: true,
    });
  });

  // The registry NAME spelling. RFC 9360 §2.
  test("matches a hashAlg spelled as its registry name", () => {
    expect(
      resolveWideCertBinding(bucket(["SHA-512", digest(ShaKit.S512(LEAF))]), CERT_KEY),
    ).toStrictEqual({ algorithm: "SHA-512", matches: true });
  });

  test("reports a mismatch rather than dropping it", () => {
    expect(
      resolveWideCertBinding(bucket([-44, Buffer.alloc(64, 9)]), CERT_KEY),
    ).toStrictEqual({
      algorithm: "SHA-512",
      matches: false,
    });
  });

  /**
   * ⚠ `matches: undefined` is ASSERTED-BUT-UNPROVABLE, not a mismatch: `false`
   * would blame the token for a WRONG certificate when this key holds none.
   *
   * ⚠ `toStrictEqual` decides this row — `toEqual` treats a MISSING property as
   * equal to an `undefined` one, so `{ algorithm }` alone would satisfy it, while
   * `verifyCertBinding` reads `matches === undefined` to choose this arm.
   */
  test("reports a binding it cannot prove when the key holds no certificate", () => {
    expect(
      resolveWideCertBinding(bucket([-44, Buffer.alloc(64, 9)]), CHAINLESS),
    ).toStrictEqual({ algorithm: "SHA-512", matches: undefined });
  });

  /**
   * ⚠ The JOSE-carried algorithms are NOT answered here: they ride the domain
   * header and `verifyCertBinding` compares them as strings, so resolving them
   * twice would be two answers to one question.
   */
  test.each([
    [-16, "SHA-256"],
    [-14, "SHA-1"],
  ])(
    "declines %s (%s) — JOSE carries it, so the domain header already has it",
    (label) => {
      expect(
        resolveWideCertBinding(bucket([label, Buffer.alloc(32, 1)]), CERT_KEY),
      ).toBeUndefined();
    },
  );

  test.each([
    ["no x5t at all", new Map<CoseLabel, unknown>([[1, -7]])],
    ["a non-array value", bucket("nonsense")],
    ["a one-element array", bucket([-44])],
    ["a non-bstr hash value", bucket([-44, "nonsense"])],
    // SHA-512/256 is a distinct truncated variant and `ShaAlgorithm` offers no
    // method for it, so it stays unimplemented. RFC 9054 §3.2.
    ["SHA-512/256, which has no ShaKit method", bucket([-17, Buffer.alloc(32, 1)])],
    ["an unregistered algorithm", bucket([-999, Buffer.alloc(32, 1)])],
  ])("declines %s", (_what, map) => {
    expect(resolveWideCertBinding(map, CERT_KEY)).toBeUndefined();
  });

  test("declines an absent bucket", () => {
    expect(resolveWideCertBinding(undefined, CERT_KEY)).toBeUndefined();
  });
});
