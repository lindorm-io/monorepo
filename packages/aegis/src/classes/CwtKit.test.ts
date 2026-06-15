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

  test("round-trips structured claims (act, sub_id, events, authorization_details)", () => {
    const withStructured = {
      ...common,
      act: { subject: "actor-1", issuer: "https://delegator/" },
      subjectId: { format: "iss_sub", iss: "https://issuer/", sub: "u" },
      events: { "urn:lindorm:event:test": {} },
      authorizationDetails: [{ type: "payment_initiation", amount: 100 }],
    };

    const { claims } = kit.verify(kit.sign(withStructured));

    expect(claims).toEqual(withStructured);
  });

  test("round-trips a cnf confirmation key via COSE_Key", () => {
    const X = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE"; // 32-byte b64url
    const confirmation = { key: { kty: "EC", crv: "P-256", x: X, y: X } };

    const { claims } = kit.verify(kit.sign({ ...common, confirmation }));

    expect(claims.confirmation).toEqual(confirmation);
  });

  test("rejects a tampered payload", () => {
    const token = kit.sign(common);
    token[token.length - 5] ^= 0xff; // flip a signature byte
    expect(() => kit.verify(token)).toThrow(AegisError);
  });
});
