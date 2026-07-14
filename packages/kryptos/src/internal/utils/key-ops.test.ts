import { describe, expect, test } from "vitest";
import type {
  KryptosAlgorithm,
  KryptosOperation,
  KryptosUse,
} from "../../types/index.js";
import { calculateKeyOps } from "./key-ops.js";

// `operations` is the capability of the KEY MATERIAL — deliberately neither JOSE
// `key_ops` nor WebCrypto usages (a private JWK embeds the public half, so a full
// keypair reports [sign, verify]; WebCrypto would say [sign]). This table IS the
// contract; every row of the design's capability table appears here, both halves.

type Row = [KryptosAlgorithm, KryptosUse, boolean, Array<KryptosOperation>];

const BOTH_HALVES = true;
const PUBLIC_ONLY = false;

const ROWS: Array<Row> = [
  // sig, asymmetric — the private half implies the public one
  ["ES256", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["ES256", "sig", PUBLIC_ONLY, ["verify"]],
  ["ES512", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["ES512", "sig", PUBLIC_ONLY, ["verify"]],
  ["EdDSA", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["EdDSA", "sig", PUBLIC_ONLY, ["verify"]],
  ["RS256", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["RS256", "sig", PUBLIC_ONLY, ["verify"]],
  ["PS512", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["PS512", "sig", PUBLIC_ONLY, ["verify"]],
  ["ML-DSA-44", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["ML-DSA-44", "sig", PUBLIC_ONLY, ["verify"]],
  ["ML-DSA-87", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["ML-DSA-87", "sig", PUBLIC_ONLY, ["verify"]],

  // sig, oct — the secret lives in the private half and both signs and verifies
  ["HS256", "sig", BOTH_HALVES, ["sign", "verify"]],
  ["HS512", "sig", BOTH_HALVES, ["sign", "verify"]],

  // ECDH-ES — half-INDEPENDENT on purpose: no derivation separates the sender
  // (recipient's public key) from the recipient (its own private key)
  ["ECDH-ES", "enc", BOTH_HALVES, ["deriveKey", "deriveBits"]],
  ["ECDH-ES", "enc", PUBLIC_ONLY, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A128KW", "enc", BOTH_HALVES, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A128KW", "enc", PUBLIC_ONLY, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A192KW", "enc", BOTH_HALVES, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A256KW", "enc", PUBLIC_ONLY, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A128GCMKW", "enc", BOTH_HALVES, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A192GCMKW", "enc", PUBLIC_ONLY, ["deriveKey", "deriveBits"]],
  ["ECDH-ES+A256GCMKW", "enc", BOTH_HALVES, ["deriveKey", "deriveBits"]],

  // RSA-OAEP — the only family where the halves genuinely differ
  ["RSA-OAEP", "enc", BOTH_HALVES, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]],
  ["RSA-OAEP", "enc", PUBLIC_ONLY, ["encrypt", "wrapKey"]],
  ["RSA-OAEP-256", "enc", BOTH_HALVES, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]],
  ["RSA-OAEP-256", "enc", PUBLIC_ONLY, ["encrypt", "wrapKey"]],
  ["RSA-OAEP-384", "enc", BOTH_HALVES, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]],
  ["RSA-OAEP-384", "enc", PUBLIC_ONLY, ["encrypt", "wrapKey"]],
  ["RSA-OAEP-512", "enc", BOTH_HALVES, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]],
  ["RSA-OAEP-512", "enc", PUBLIC_ONLY, ["encrypt", "wrapKey"]],

  // oct dir — the content encryption key itself
  ["dir", "enc", BOTH_HALVES, ["encrypt", "decrypt"]],

  // oct key wrapping
  ["A128KW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],
  ["A192KW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],
  ["A256KW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],
  ["A128GCMKW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],
  ["A192GCMKW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],
  ["A256GCMKW", "enc", BOTH_HALVES, ["wrapKey", "unwrapKey"]],

  // oct PBES2 — a passphrase derives the wrapping key
  ["PBES2-HS256+A128KW", "enc", BOTH_HALVES, ["deriveKey"]],
  ["PBES2-HS384+A192KW", "enc", BOTH_HALVES, ["deriveKey"]],
  ["PBES2-HS512+A256KW", "enc", BOTH_HALVES, ["deriveKey"]],
];

describe("calculateKeyOps", () => {
  test.each(ROWS)(
    "%s (%s, hasPrivateKey=%s) yields %j",
    (algorithm, use, hasPrivateKey, expected) => {
      expect(calculateKeyOps({ algorithm, use, hasPrivateKey })).toEqual(expected);
    },
  );

  test("throws for an algorithm that cannot be used for encryption", () => {
    expect(() =>
      calculateKeyOps({ algorithm: "ES256", use: "enc", hasPrivateKey: true }),
    ).toThrow(/not an encryption algorithm/i);
  });

  test("throws for an unsupported key use", () => {
    expect(() =>
      calculateKeyOps({
        algorithm: "ES256",
        use: "bogus" as KryptosUse,
        hasPrivateKey: true,
      }),
    ).toThrow(/Unsupported key use/i);
  });
});
