import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterAll, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  encryptCose,
  isEncryptedCose,
} from "./cose-encryption.js";
import { signCose } from "./sign-cose.js";
import { verifyCose } from "./verify-cose.js";

// Between the fixture's issuedAt (1700000000) and expiresAt (1700003600), so the
// in-kit temporal check (Phase 9 R10) accepts the round-tripped CWT.
MockDate.set(new Date(1700001000 * 1000));
afterAll(() => MockDate.reset());

const logger = createMockLogger();

const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
};

// The direct-dispatch COSE path that replaced the dropped `CoseKit` façade: the
// verb utils sign via `signCose` (algClass → CwtKit/CwmKit), wrap in a
// COSE_Encrypt0 via `encryptCose`, and read back with `decryptCose` + `verifyCose`.
describe("COSE sign-then-encrypt", () => {
  const enc = KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

  test("round-trips through decrypt + verify", () => {
    const inner = signCose({ kryptos: TEST_EC_KEY_SIG, logger, common, format: "cwt" });
    expect(isEncryptedCose(inner)).toBe(false); // a bare signed CWT (COSE_Sign1)

    const encrypted = encryptCose({ kryptos: enc, logger, inner });
    expect(isEncryptedCose(encrypted)).toBe(true); // a COSE_Encrypt0
    expect(decodeEncryptedCoseKid(encrypted)).toBe(enc.id); // recipient kid, no decrypt

    const decrypted = decryptCose({ kryptos: enc, logger, token: encrypted });
    expect(
      verifyCose({ kryptos: TEST_EC_KEY_SIG, logger, token: decrypted }).claims,
    ).toEqual(common);
  });
});
