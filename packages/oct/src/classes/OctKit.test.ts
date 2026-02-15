import { MOCK_KRYPTOS_OCT_ENC, MOCK_KRYPTOS_OCT_SIG_HS256 } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { OctError } from "../errors";
import { OctKit } from "./OctKit";

describe("OctKit", () => {
  let kit: OctKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new OctKit({ kryptos: MOCK_KRYPTOS_OCT_SIG_HS256 });
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
    expect(() => kit.assert("wrong", signature)).toThrow(OctError);
  });

  test("should throw on encryption algorithm", () => {
    expect(() => new OctKit({ kryptos: MOCK_KRYPTOS_OCT_ENC as any })).toThrow(OctError);
    expect(() => new OctKit({ kryptos: MOCK_KRYPTOS_OCT_ENC as any })).toThrow(
      "OctKit only supports signing algorithms",
    );
  });
});
