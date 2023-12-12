import { CryptoError } from "../errors";
import { assertEccSignature, createEccSignature, verifyEccSignature } from "./ecc-signature";

const PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----\n" +
  "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIBGma7xGZpaAngFXf3\n" +
  "mJF3IxZfDpI+6wU564K+eehxX104v6dZetjSfMx0rvsYX/s6cO2P3GE7R95VxWEk\n" +
  "+f4EX0qhgYkDgYYABAB8cBfDwCi41G4kVW4V3Y86nIMMCypYzfO8gYjpS091lxkM\n" +
  "goTRS3LM1p65KQfwBolrWIdVrbbOILASf06fQsHw5gEt4snVuMBO+LS6pesX9vA8\n" +
  "QT1LjX75Xq2InnLY1VToeNmxkuM+oDZgqHOYwzfUhu+zZaA5AuEkqPi47TA9iCSY\n" +
  "VQ==\n" +
  "-----END PRIVATE KEY-----\n";

const PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAfHAXw8AouNRuJFVuFd2POpyDDAsq\n" +
  "WM3zvIGI6UtPdZcZDIKE0UtyzNaeuSkH8AaJa1iHVa22ziCwEn9On0LB8OYBLeLJ\n" +
  "1bjATvi0uqXrF/bwPEE9S41++V6tiJ5y2NVU6HjZsZLjPqA2YKhzmMM31Ibvs2Wg\n" +
  "OQLhJKj4uO0wPYgkmFU=\n" +
  "-----END PUBLIC KEY-----\n";

describe("ecc-signature", () => {
  describe("SHA256", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA256",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA256",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("SHA384", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA384",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA384",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("SHA512", () => {
    test("should create signature at base64 digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA512",
          format: "base64",
        }),
      ).toStrictEqual(expect.any(String));
    });

    test("should create signature at hex digest", () => {
      expect(
        createEccSignature({
          key: PRIVATE_KEY,
          data: "data",
          algorithm: "SHA512",
          format: "hex",
        }),
      ).toStrictEqual(expect.any(String));
    });
  });

  describe("verify", () => {
    test("should verify signature", () => {
      const signature = createEccSignature({ key: PRIVATE_KEY, data: "data" });

      expect(verifyEccSignature({ key: PUBLIC_KEY, data: "data", signature })).toBe(true);
    });
  });

  describe("assert", () => {
    test("should assert signature", () => {
      const signature = createEccSignature({ key: PRIVATE_KEY, data: "data" });

      expect(() => assertEccSignature({ key: PUBLIC_KEY, data: "data", signature })).not.toThrow();
    });

    test("should throw error on invalid signature", () => {
      const signature = createEccSignature({ key: PRIVATE_KEY, data: "data" });

      expect(() => assertEccSignature({ key: PUBLIC_KEY, data: "invalid", signature })).toThrow(
        CryptoError,
      );
    });
  });
});
