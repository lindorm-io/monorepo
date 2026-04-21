import {
  KRYPTOS_OKP_ENC_X25519,
  KRYPTOS_OKP_ENC_X448,
  KRYPTOS_OKP_SIG_ED25519,
} from "@lindorm/kryptos/fixtures";
import { OkpError } from "../errors/index.js";
import { OkpKit } from "./OkpKit.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("OkpKit", () => {
  let kit: OkpKit;
  let signature: Buffer;

  beforeEach(() => {
    kit = new OkpKit({ kryptos: KRYPTOS_OKP_SIG_ED25519 });
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
    expect(() => kit.assert("wrong", signature)).toThrow(OkpError);
  });

  test("should throw on X25519 encryption curve", () => {
    expect(() => new OkpKit({ kryptos: KRYPTOS_OKP_ENC_X25519 as any })).toThrow(
      OkpError,
    );
    expect(() => new OkpKit({ kryptos: KRYPTOS_OKP_ENC_X25519 as any })).toThrow(
      "OkpKit only supports signing curves",
    );
  });

  test("should throw on X448 encryption curve", () => {
    expect(() => new OkpKit({ kryptos: KRYPTOS_OKP_ENC_X448 as any })).toThrow(OkpError);
    expect(() => new OkpKit({ kryptos: KRYPTOS_OKP_ENC_X448 as any })).toThrow(
      "OkpKit only supports signing curves",
    );
  });
});
