import { CryptoError } from "../error";
import { CryptoEcc } from "./CryptoEcc";

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

describe("CryptoEcc", () => {
  let crypto: CryptoEcc;
  let signature: string;

  beforeEach(() => {
    crypto = new CryptoEcc({
      privateKey: PRIVATE_KEY,
      publicKey: PUBLIC_KEY,
    });
    signature = crypto.sign("string");
  });

  test("should verify", () => {
    expect(crypto.verify("string", signature)).toBe(true);
  });

  test("should reject", () => {
    expect(crypto.verify("wrong", signature)).toBe(false);
  });

  test("should assert", () => {
    expect(() => crypto.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => crypto.assert("wrong", signature)).toThrow(CryptoError);
  });
});
