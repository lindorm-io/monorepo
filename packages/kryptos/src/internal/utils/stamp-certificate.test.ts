import MockDate from "mockdate";
import { generateOkpKey } from "./okp/generate-key.js";
import { stampCertificate } from "./stamp-certificate.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const MOCKED_NOW = new Date("2024-01-01T08:00:00.000Z");
const NOT_BEFORE = new Date("2024-01-01T00:00:00.000Z");
const EXPIRES_AT = new Date("2025-01-01T00:00:00.000Z");
const SERIAL = Buffer.from("0123456789abcdef0123456789abcdef", "hex");

beforeEach(() => {
  MockDate.set(MOCKED_NOW.toISOString());
});

afterEach(() => {
  MockDate.reset();
});

describe("stampCertificate determinism", () => {
  // Uses Ed25519 because EdDSA signatures are deterministic per RFC 8032,
  // making the full DER output byte-stable across calls. ECDSA signatures
  // would re-randomize per call, defeating byte-equality assertions.

  test("self-signed: identical inputs + injected serial produce byte-identical DER", () => {
    const key = generateOkpKey({ algorithm: "EdDSA", curve: "Ed25519" });
    const subjectKryptos = {
      id: "fixed-id",
      issuer: "https://issuer.example.com",
      notBefore: NOT_BEFORE,
      expiresAt: EXPIRES_AT,
      use: "sig" as const,
      type: "OKP" as const,
      algorithm: "EdDSA" as const,
      curve: "Ed25519" as const,
      publicKey: key.publicKey,
      privateKey: key.privateKey,
    };

    const a = stampCertificate({
      certificate: { mode: "self-signed" },
      subjectKryptos,
      serialNumber: SERIAL,
    });
    const b = stampCertificate({
      certificate: { mode: "self-signed" },
      subjectKryptos,
      serialNumber: SERIAL,
    });

    expect(a[0]).toBe(b[0]);
  });

  test("root-ca: identical inputs + injected serial produce byte-identical DER", () => {
    const key = generateOkpKey({ algorithm: "EdDSA", curve: "Ed25519" });
    const subjectKryptos = {
      id: "fixed-ca-id",
      issuer: "https://ca.example.com",
      notBefore: NOT_BEFORE,
      expiresAt: EXPIRES_AT,
      use: "sig" as const,
      type: "OKP" as const,
      algorithm: "EdDSA" as const,
      curve: "Ed25519" as const,
      publicKey: key.publicKey,
      privateKey: key.privateKey,
    };

    const a = stampCertificate({
      certificate: { mode: "root-ca" },
      subjectKryptos,
      serialNumber: SERIAL,
    });
    const b = stampCertificate({
      certificate: { mode: "root-ca" },
      subjectKryptos,
      serialNumber: SERIAL,
    });

    expect(a[0]).toBe(b[0]);
  });

  test("ca-signed: identical inputs + injected serial produce byte-identical DER", async () => {
    // Build a real CA via KryptosKit so stampCertificate's ca-signed branch has
    // a valid IKryptos to delegate to. Both CA and child use Ed25519 for
    // deterministic signatures.
    const { KryptosKit } = await import("../../classes/KryptosKit.js");
    const ca = KryptosKit.generate.sig.okp({
      algorithm: "EdDSA",
      curve: "Ed25519",
      issuer: "https://ca.example.com",
      notBefore: new Date("2023-06-01T00:00:00.000Z"),
      expiresAt: new Date("2028-06-01T00:00:00.000Z"),
      certificate: { mode: "root-ca" },
    });

    const childKey = generateOkpKey({ algorithm: "EdDSA", curve: "Ed25519" });
    const subjectKryptos = {
      id: "fixed-child-id",
      issuer: "https://child.example.com",
      notBefore: NOT_BEFORE,
      expiresAt: EXPIRES_AT,
      use: "sig" as const,
      type: "OKP" as const,
      algorithm: "EdDSA" as const,
      curve: "Ed25519" as const,
      publicKey: childKey.publicKey,
      privateKey: childKey.privateKey,
    };

    const a = stampCertificate({
      certificate: { mode: "ca-signed", ca },
      subjectKryptos,
      serialNumber: SERIAL,
    });
    const b = stampCertificate({
      certificate: { mode: "ca-signed", ca },
      subjectKryptos,
      serialNumber: SERIAL,
    });

    expect(a[0]).toBe(b[0]);
    expect(a[1]).toBe(b[1]);
  });
});
