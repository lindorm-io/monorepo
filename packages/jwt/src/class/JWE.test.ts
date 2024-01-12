import { createMockLogger } from "@lindorm-io/core-logger";
import { createTestKeystore } from "@lindorm-io/keystore";
import { randomBytes } from "crypto";
import { RSA_WEB_KEY_SET } from "../fixtures/rsa-keys.fixture";
import { JWE } from "./JWE";

describe("JWE", () => {
  let jwe: JWE;

  beforeEach(() => {
    jwe = new JWE(
      { encryptionKeyAlgorithm: "RSA-OAEP-256", keyType: "RSA" },
      createTestKeystore([RSA_WEB_KEY_SET]),
      createMockLogger(),
    );
  });

  test("should encrypt and decrypt a jwe", () => {
    const token = randomBytes(32).toString("hex");
    const jweToken = jwe.encrypt(token);

    expect(jweToken).toStrictEqual(expect.any(String));
    expect(jwe.decrypt(jweToken)).toBe(token);
  });
});
