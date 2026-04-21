import { createPublicKey, generateKeyPairSync } from "crypto";
import { spkiFromPublicKey } from "./spki-from-public-key";
import { describe, expect, test } from "vitest";

describe("spkiFromPublicKey", () => {
  test("EC public key in SPKI form passes through unchanged", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const der = publicKey.export({ format: "der", type: "spki" }) as Buffer;

    expect(spkiFromPublicKey(der, "EC").equals(der)).toBe(true);
  });

  test("RSA PKCS#1 public key is wrapped in SPKI", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pkcs1 = publicKey.export({ format: "der", type: "pkcs1" }) as Buffer;
    const expected = publicKey.export({ format: "der", type: "spki" }) as Buffer;

    expect(spkiFromPublicKey(pkcs1, "RSA").equals(expected)).toBe(true);
  });

  test("OKP Ed25519 public key in SPKI form passes through", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ format: "der", type: "spki" }) as Buffer;

    expect(spkiFromPublicKey(der, "OKP").equals(der)).toBe(true);
  });

  test("oct type throws", () => {
    expect(() => spkiFromPublicKey(Buffer.alloc(16), "oct")).toThrow(
      "Symmetric keys have no SubjectPublicKeyInfo",
    );
  });

  test("round-trips with createPublicKey", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-384" });
    const der = publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const spki = spkiFromPublicKey(der, "EC");
    const obj = createPublicKey({ key: spki, format: "der", type: "spki" });
    expect(obj.asymmetricKeyType).toBe("ec");
  });
});
