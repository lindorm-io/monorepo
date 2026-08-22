import { describe, expect, test } from "vitest";
import { CoseError, CweError, CwsError } from "../../errors/index.js";
import { Tag } from "./cbor.js";
import { requireCose } from "./require-cose.js";
import { COSE_TAG } from "./structures.js";

const SIGN1 = new Tag(COSE_TAG.sign1, ["protected", "unprotected", "payload", "sig"]);
const ENCRYPT0 = new Tag(COSE_TAG.encrypt0, ["protected", "unprotected", "ct"]);

const words = {
  error: CwsError,
  message: "Malformed COSE structure",
  title: "Malformed COSE Structure",
  details:
    "A COSE_Sign1/COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
};

describe("requireCose", () => {
  test("returns the structure array when it matches the arity and tag", () => {
    expect(
      requireCose(SIGN1, { arity: { exactly: 4 }, tags: [COSE_TAG.sign1], ...words }),
    ).toHaveLength(4);
  });

  test("strips the outer CWT tag (61) to reach the structure", () => {
    // aegis envelopes every COSE token it emits; a foreign producer need not.
    expect(
      requireCose(new Tag(COSE_TAG.cwt, SIGN1), {
        arity: { exactly: 4 },
        tags: [COSE_TAG.sign1],
        ...words,
      }),
    ).toHaveLength(4);
  });

  test("accepts a BARE, untagged structure array", () => {
    expect(
      requireCose(["protected", "unprotected", "payload", "sig"], {
        arity: { exactly: 4 },
        ...words,
      }),
    ).toHaveLength(4);
  });

  test("refuses a structure of the wrong arity", () => {
    expect(() => requireCose(ENCRYPT0, { arity: { exactly: 4 }, ...words })).toThrow(
      expect.objectContaining({ code: "cose_malformed" }),
    );
  });

  test("refuses a TAGGED structure whose tag is not among those asked for", () => {
    // A COSE_Encrypt0 read as a COSE_Sign1 is the wrong STRUCTURE, not merely the
    // wrong length, so it must not be unwrapped into the wrong shape.
    expect(() =>
      requireCose(ENCRYPT0, {
        arity: { exactly: 3 },
        tags: [COSE_TAG.sign1],
        ...words,
      }),
    ).toThrow(expect.objectContaining({ code: "cose_malformed" }));
  });

  test("refuses anything that is not an array at all", () => {
    for (const value of [undefined, null, 5, "cose", { 0: "protected" }]) {
      expect(() => requireCose(value, { arity: { atLeast: 2 }, ...words })).toThrow(
        expect.objectContaining({ code: "cose_malformed" }),
      );
    }
  });

  test("`atLeast` admits a LONGER structure", () => {
    // The claims decoder does not care what a future COSE revision appends.
    expect(
      requireCose(["p", "u", "payload", "sig", "extra"], {
        arity: { atLeast: 3 },
        ...words,
      }),
    ).toHaveLength(5);
  });

  test("the code is `cose_malformed` on every wire; the words are the caller's", () => {
    let thrown: { code?: string; message?: string; title?: string; details?: string } =
      {};

    try {
      requireCose(undefined, {
        arity: { exactly: 3 },
        error: CweError,
        message: "Malformed COSE_Encrypt0",
        title: "Malformed COSE_Encrypt0",
        details:
          "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].",
      });
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect({
      code: thrown.code,
      message: thrown.message,
      title: thrown.title,
      details: thrown.details,
    }).toMatchSnapshot();
  });

  test("the refusal lands on the leaf error class the caller named", () => {
    expect(() => requireCose(undefined, { arity: { exactly: 4 }, ...words })).toThrow(
      CwsError,
    );
    expect(() =>
      requireCose(undefined, {
        arity: { atLeast: 2 },
        error: CoseError,
        message: "Malformed CWT",
        title: "Malformed CWT",
        details: "The CWT does not contain a recognisable COSE structure.",
      }),
    ).toThrow(CoseError);
  });
});
