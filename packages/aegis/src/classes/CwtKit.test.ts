import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { CwtKit } from "./CwtKit.js";

const common = {
  issuer: "https://issuer.lindorm.io/",
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  expiresAt: new Date(1700003600 * 1000),
  issuedAt: new Date(1700000000 * 1000),
  tokenId: "the-jti",
  clientId: "client-1",
  scope: ["read", "write"],
};

describe("CwtKit (COSE_Sign1)", () => {
  let kit: CwtKit;

  beforeEach(() => {
    kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });
  });

  test("mints a CWT tagged with the CWT tag (61 = 0xd83d)", () => {
    const token = kit.sign(common, { typ: "application/at+cwt" });
    expect(Buffer.isBuffer(token)).toBe(true);
    // CBOR tag 61 = 0xd8 0x3d
    expect(token.subarray(0, 2).toString("hex")).toBe("d83d");
  });

  test("round-trips the domain claims through sign -> verify", () => {
    const token = kit.sign(common, { typ: "application/at+cwt" });
    const { claims, typ } = kit.verify(token);

    expect(claims).toEqual(common);
    expect(typ).toBe("application/at+cwt");
  });

  test("decode exposes kid / alg / typ without verifying", () => {
    const token = kit.sign(common, { typ: "application/at+cwt" });
    const decoded = CwtKit.decode(token);

    expect(decoded.kid).toBe(TEST_EC_KEY_SIG.id);
    expect(decoded.algorithm).toBe("ES512"); // TEST_EC_KEY_SIG is P-521
    expect(decoded.typ).toBe("application/at+cwt");
  });

  test("rejects a tampered payload", () => {
    const token = kit.sign(common);
    token[token.length - 5] ^= 0xff; // flip a signature byte
    expect(() => kit.verify(token)).toThrow(AegisError);
  });
});
