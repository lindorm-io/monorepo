import { describe, expect, test } from "vitest";
import { CweError } from "../../errors/index.js";
import { Tag, encodeCbor } from "./cbor.js";
import { splitEncrypt0 } from "./split-encrypt0.js";
import { COSE_TAG } from "./structures.js";

const PROTECTED = Buffer.from([0xa1, 0x01, 0x03]);
const CIPHERTEXT = Buffer.from("ciphertext-with-tag", "utf8");

const unprotected = (): Map<number, unknown> =>
  new Map<number, unknown>([[5, Buffer.from("iv", "utf8")]]);

const encrypt0 = (): Buffer =>
  encodeCbor(new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), CIPHERTEXT]));

describe("splitEncrypt0", () => {
  test("returns the three COSE_Encrypt0 segments", () => {
    const segments = splitEncrypt0(encrypt0());

    expect(Buffer.from(segments.protectedBstr)).toEqual(PROTECTED);
    expect(Buffer.from(segments.coseCiphertext)).toEqual(CIPHERTEXT);
    expect(segments.unprotected).toBeInstanceOf(Map);
  });

  test("strips the outer CWT tag (61)", () => {
    // aegis envelopes what it emits; a foreign COSE_Encrypt0 arrives bare, and
    // `decrypt` and `decode` share this one opening.
    const tagged = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), CIPHERTEXT]),
      ),
    );

    expect(Buffer.from(splitEncrypt0(tagged).coseCiphertext)).toEqual(CIPHERTEXT);
  });

  test("reads a BARE, untagged 3-element array", () => {
    const bare = encodeCbor([PROTECTED, unprotected(), CIPHERTEXT]);

    expect(Buffer.from(splitEncrypt0(bare).protectedBstr)).toEqual(PROTECTED);
  });

  test("refuses a COSE_Sign1 read as a COSE_Encrypt0", () => {
    const sign1 = encodeCbor(
      new Tag(COSE_TAG.sign1, [PROTECTED, unprotected(), CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(sign1)).toThrow(
      expect.objectContaining({ code: "cose_malformed" }),
    );
  });

  test("refuses a structure of the wrong arity", () => {
    const four = encodeCbor(
      new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), CIPHERTEXT, CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(four)).toThrow(CweError);
  });

  test("the refusal names the COSE_Encrypt0 shape", () => {
    let thrown: { code?: string; title?: string; details?: string } = {};

    try {
      splitEncrypt0(encodeCbor("not a cose structure"));
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect({
      code: thrown.code,
      title: thrown.title,
      details: thrown.details,
    }).toMatchSnapshot();
  });

  test("does NOT require an IV — that gate belongs to `decrypt` alone", () => {
    // ⚠ `CweKit.decode` is a header-only read that accepts a COSE_Encrypt0 with no
    // IV, so folding the IV check in here turns a readable token into a refused one.
    const noIv = encodeCbor(
      new Tag(COSE_TAG.encrypt0, [PROTECTED, new Map<number, unknown>(), CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(noIv)).not.toThrow();
  });
});
