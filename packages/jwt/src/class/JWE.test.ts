import { createMockLogger } from "@lindorm-io/core-logger";
import { randomBytes } from "crypto";
import { RSA_KEY_SET } from "../fixtures/rsa-keys.fixture";
import { JWE } from "./JWE";

describe("JWE", () => {
  test("should encrypt and decrypt a jwe", () => {
    const jwe = new JWE({ keySet: RSA_KEY_SET }, createMockLogger());

    const token = randomBytes(32).toString("hex");
    const jweToken = jwe.encrypt(token);

    expect(jweToken).toStrictEqual(expect.any(String));
    expect(jwe.decrypt(jweToken)).toBe(token);
  });
});
