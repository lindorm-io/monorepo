import type { ShaAlgorithm } from "@lindorm/types";
import type { BinaryToTextEncoding } from "crypto";
import { ShaError } from "../errors/index.js";
import { ShaKit } from "./ShaKit.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("ShaKit", () => {
  let kit: ShaKit;
  let hash: string;

  beforeEach(() => {
    kit = new ShaKit();
    hash = kit.hash("string");
  });

  test("should verify", () => {
    expect(kit.verify("string", hash)).toEqual(true);
  });

  test("should reject", () => {
    expect(kit.verify("wrong", hash)).toEqual(false);
  });

  test("should assert", () => {
    expect(() => kit.assert("string", hash)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => kit.assert("wrong", hash)).toThrow(ShaError);
  });

  test("should reject a hash of unequal length without throwing", () => {
    expect(() => kit.verify("string", hash.slice(0, 10))).not.toThrow();
    expect(kit.verify("string", hash.slice(0, 10))).toEqual(false);
    expect(kit.verify("string", hash + hash)).toEqual(false);
  });

  test("should reject an empty hash without throwing", () => {
    expect(() => kit.verify("string", "")).not.toThrow();
    expect(kit.verify("string", "")).toEqual(false);
  });

  test("should reject a garbage hash without throwing", () => {
    expect(() => kit.verify("string", "!! not a digest !!")).not.toThrow();
    expect(kit.verify("string", "!! not a digest !!")).toEqual(false);
  });

  test("should throw error on a hash of unequal length", () => {
    expect(() => kit.assert("string", hash.slice(0, 10))).toThrow(ShaError);
    expect(() => kit.assert("string", "")).toThrow(ShaError);
  });

  describe.each(["SHA1", "SHA256", "SHA384", "SHA512"] as Array<ShaAlgorithm>)(
    "%s",
    (algorithm) => {
      describe.each([
        "base64",
        "base64url",
        "hex",
        "binary",
      ] as Array<BinaryToTextEncoding>)("%s", (encoding) => {
        let configured: ShaKit;

        beforeEach(() => {
          configured = new ShaKit({ algorithm, encoding });
        });

        test("should verify its own hash", () => {
          expect(configured.verify("string", configured.hash("string"))).toEqual(true);
        });

        test("should reject a wrong hash of equal length", () => {
          expect(configured.verify("string", configured.hash("wrong"))).toEqual(false);
        });

        test("should reject an unequal length hash without throwing", () => {
          const short = configured.hash("string").slice(0, 8);

          expect(() => configured.verify("string", short)).not.toThrow();
          expect(configured.verify("string", short)).toEqual(false);
        });

        test("should assert its own hash", () => {
          expect(configured.assert("string", configured.hash("string"))).toBeUndefined();
        });

        test("should throw error on mismatch", () => {
          expect(() => configured.assert("string", configured.hash("wrong"))).toThrow(
            ShaError,
          );
        });
      });
    },
  );

  describe("static hashes", () => {
    const buffer = Buffer.from("data", "utf8");

    test("should hash Buffer input with S1", () => {
      expect(ShaKit.S1(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S256", () => {
      expect(ShaKit.S256(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S384", () => {
      expect(ShaKit.S384(buffer)).toMatchSnapshot();
    });

    test("should hash Buffer input with S512", () => {
      expect(ShaKit.S512(buffer)).toMatchSnapshot();
    });

    test("should produce identical output for equivalent string and Buffer inputs", () => {
      expect(ShaKit.S1(buffer)).toEqual(ShaKit.S1("data"));
      expect(ShaKit.S256(buffer)).toEqual(ShaKit.S256("data"));
      expect(ShaKit.S384(buffer)).toEqual(ShaKit.S384("data"));
      expect(ShaKit.S512(buffer)).toEqual(ShaKit.S512("data"));
    });
  });
});
