import {
  KRYPTOS_AKP_SIG_ML_DSA_65,
  KRYPTOS_OKP_SIG_ED25519,
} from "@lindorm/kryptos/fixtures";
import { AkpError } from "../errors/index.js";
import { AkpKit } from "./AkpKit.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("AkpKit", () => {
  let kit: AkpKit;
  let signature: Buffer;

  beforeEach(() => {
    kit = new AkpKit({ kryptos: KRYPTOS_AKP_SIG_ML_DSA_65 });
    signature = kit.sign("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", signature)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", signature)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", signature)).toThrow(AkpError);
  });

  test("should format signature as base64 by default", () => {
    expect(typeof kit.format(signature)).toEqual("string");
    expect(Buffer.from(kit.format(signature), "base64")).toEqual(signature);
  });

  test("should throw on non-AKP kryptos", () => {
    expect(() => new AkpKit({ kryptos: KRYPTOS_OKP_SIG_ED25519 as any })).toThrow(
      AkpError,
    );
    expect(() => new AkpKit({ kryptos: KRYPTOS_OKP_SIG_ED25519 as any })).toThrow(
      "Invalid Kryptos instance",
    );
  });
});
