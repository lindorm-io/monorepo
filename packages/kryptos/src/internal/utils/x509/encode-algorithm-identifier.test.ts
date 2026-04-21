import {
  encodeX509AlgorithmIdentifier,
  resolveSignatureDescriptor,
} from "./encode-algorithm-identifier";
import { describe, expect, test } from "vitest";

describe("resolveSignatureDescriptor", () => {
  test("RS256 -> sha256WithRSAEncryption with NULL params", () => {
    const descriptor = resolveSignatureDescriptor({ algorithm: "RS256", keyType: "RSA" });
    expect(descriptor).toMatchSnapshot();
  });

  test("ES256 -> ecdsaWithSHA256 without params", () => {
    const descriptor = resolveSignatureDescriptor({ algorithm: "ES256", keyType: "EC" });
    expect(descriptor).toMatchSnapshot();
  });

  test("EdDSA + Ed25519 -> ed25519 OID", () => {
    const descriptor = resolveSignatureDescriptor({
      algorithm: "EdDSA",
      keyType: "OKP",
      okpCurve: "Ed25519",
    });
    expect(descriptor).toMatchSnapshot();
  });

  test("EdDSA + Ed448 -> ed448 OID", () => {
    const descriptor = resolveSignatureDescriptor({
      algorithm: "EdDSA",
      keyType: "OKP",
      okpCurve: "Ed448",
    });
    expect(descriptor).toMatchSnapshot();
  });

  test("PS256 throws deferred error", () => {
    expect(() =>
      resolveSignatureDescriptor({ algorithm: "PS256", keyType: "RSA" }),
    ).toThrow("RSA-PSS signatures (PS256) for X.509 are not yet supported");
  });

  test("oct/HS256 throws unsupported combination", () => {
    expect(() =>
      resolveSignatureDescriptor({ algorithm: "HS256", keyType: "oct" }),
    ).toThrow("Unsupported X.509 signature combination");
  });
});

describe("encodeX509AlgorithmIdentifier", () => {
  test("RSA sha256 includes NULL params", () => {
    const descriptor = resolveSignatureDescriptor({ algorithm: "RS256", keyType: "RSA" });
    expect(encodeX509AlgorithmIdentifier(descriptor).toString("hex")).toMatchSnapshot();
  });

  test("ECDSA sha384 omits params", () => {
    const descriptor = resolveSignatureDescriptor({ algorithm: "ES384", keyType: "EC" });
    expect(encodeX509AlgorithmIdentifier(descriptor).toString("hex")).toMatchSnapshot();
  });

  test("Ed25519 omits params", () => {
    const descriptor = resolveSignatureDescriptor({
      algorithm: "EdDSA",
      keyType: "OKP",
      okpCurve: "Ed25519",
    });
    expect(encodeX509AlgorithmIdentifier(descriptor).toString("hex")).toMatchSnapshot();
  });
});
