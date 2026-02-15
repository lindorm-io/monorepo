import { MOCK_KRYPTOS_RSA_ENC, MOCK_KRYPTOS_RSA_SIG_RS256 } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { RsaError } from "../errors";
import { RsaKit } from "./RsaKit";

describe("RsaKit", () => {
  let kit: RsaKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new RsaKit({ kryptos: MOCK_KRYPTOS_RSA_SIG_RS256 });
    data = randomBytes(32);
    signature = kit.sign(data);
  });

  test("should verify", () => {
    expect(kit.verify(data, signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert(data, signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(RsaError);
  });

  test("should throw on encryption algorithm", () => {
    expect(() => new RsaKit({ kryptos: MOCK_KRYPTOS_RSA_ENC as any })).toThrow(RsaError);
    expect(() => new RsaKit({ kryptos: MOCK_KRYPTOS_RSA_ENC as any })).toThrow(
      "RsaKit only supports signing algorithms",
    );
  });
});
