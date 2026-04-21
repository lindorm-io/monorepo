import { KRYPTOS_EC_ENC, KRYPTOS_EC_SIG_ES512 } from "@lindorm/kryptos/fixtures";
import { randomBytes } from "crypto";
import { EcError } from "../errors/index.js";
import { EcKit } from "./EcKit.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("EcKit", () => {
  let kit: EcKit;
  let data: Buffer;
  let signature: Buffer;

  beforeEach(() => {
    kit = new EcKit({ kryptos: KRYPTOS_EC_SIG_ES512 });
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
    expect(() => kit.assert("wrong", signature)).toThrow(EcError);
  });

  test("should throw on encryption algorithm", () => {
    expect(() => new EcKit({ kryptos: KRYPTOS_EC_ENC as any })).toThrow(EcError);
    expect(() => new EcKit({ kryptos: KRYPTOS_EC_ENC as any })).toThrow(
      "EcKit only supports signing algorithms",
    );
  });
});
