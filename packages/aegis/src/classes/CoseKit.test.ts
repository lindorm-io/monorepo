import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { CoseKit } from "./CoseKit.js";

const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
};

describe("CoseKit", () => {
  const cose = new CoseKit({ logger: createMockLogger() });
  const enc = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

  test("sign-then-encrypt round-trips through decrypt + verify", () => {
    const inner = cose.sign(TEST_EC_KEY_SIG, common);
    expect(cose.isEncrypted(inner)).toBe(false); // a bare signed CWT

    const encrypted = cose.encrypt(enc, inner);
    expect(cose.isEncrypted(encrypted)).toBe(true); // a COSE_Encrypt0
    expect(cose.decodeEncryptedKid(encrypted)).toBe(enc.id); // recipient kid, no decrypt

    const decrypted = cose.decrypt(enc, encrypted);
    expect(cose.verify(TEST_EC_KEY_SIG, decrypted).claims).toEqual(common);
  });
});
