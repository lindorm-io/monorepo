import { randomUUID } from "crypto";
import { KryptosAlgorithm, KryptosEncryption, KryptosKit } from "@lindorm/kryptos";

// Fixed raw symmetric keys for dir mode (CEK = key)
export const RAW_KEY_128 = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
export const RAW_KEY_192 = Buffer.from(
  "000102030405060708090a0b0c0d0e0f1011121314151617",
  "hex",
);
export const RAW_KEY_256 = Buffer.from(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "hex",
);

// CBC-HMAC composite keys (double-length: half for HMAC, half for AES-CBC)
export const RAW_KEY_256_CBC = Buffer.from(
  "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f",
  "hex",
);
export const RAW_KEY_384_CBC = Buffer.from(
  "404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f",
  "hex",
);
export const RAW_KEY_512_CBC = Buffer.from(
  "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf",
  "hex",
);

// Key Encryption Keys for KW modes
export const KEK_128 = Buffer.from("c0c1c2c3c4c5c6c7c8c9cacbcccdcecf", "hex");
export const KEK_192 = Buffer.from(
  "d0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7",
  "hex",
);
export const KEK_256 = Buffer.from(
  "f0f1f2f3f4f5f6f7f8f9fafbfcfdfefff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff",
  "hex",
);

/**
 * Helper to create a Kryptos oct key from raw bytes.
 */
export const createOctKryptos = (
  raw: Buffer,
  algorithm: KryptosAlgorithm,
  encryption?: KryptosEncryption,
) =>
  KryptosKit.from.der({
    id: randomUUID(),
    algorithm,
    encryption,
    privateKey: raw,
    type: "oct",
    use: "enc",
  });
