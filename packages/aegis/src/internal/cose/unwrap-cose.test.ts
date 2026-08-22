import { describe, expect, test } from "vitest";
import { Tag } from "./cbor.js";
import { COSE_TAG } from "./structures.js";
import { coseStructure, stripCwtTag, unwrapCose } from "./unwrap-cose.js";

const SIGN1 = [Buffer.alloc(0), new Map(), Buffer.from("p"), Buffer.from("s")];
const ENCRYPT0 = [Buffer.alloc(0), new Map(), Buffer.from("c")];

describe("stripCwtTag", () => {
  test("strips the outer CWT tag (61)", () => {
    const inner = new Tag(COSE_TAG.sign1, SIGN1);

    expect(stripCwtTag(new Tag(COSE_TAG.cwt, inner))).toBe(inner);
  });

  test("leaves any other tag alone — only 61 is the CWT envelope", () => {
    const sign1 = new Tag(COSE_TAG.sign1, SIGN1);

    expect(stripCwtTag(sign1)).toBe(sign1);
  });

  test("passes an untagged value through", () => {
    expect(stripCwtTag(SIGN1)).toBe(SIGN1);
  });
});

describe("coseStructure", () => {
  test("reports the structure tag through the CWT envelope", () => {
    const value = new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.mac0, SIGN1));

    expect(coseStructure(value)?.tag).toBe(COSE_TAG.mac0);
  });

  test("a BARE array carries no tag to report", () => {
    // Legal COSE, but no answer to "which structure is this?" — an untagged array
    // is not evidence, which is what `isCose` needs.
    expect(coseStructure(SIGN1)).toBeUndefined();
  });
});

describe("unwrapCose", () => {
  test("unwraps a tagged structure inside the CWT envelope", () => {
    const value = new Tag(COSE_TAG.cwt, new Tag(COSE_TAG.sign1, SIGN1));

    expect(unwrapCose(value, { arity: { exactly: 4 } })).toBe(SIGN1);
  });

  test("unwraps a BARE, untagged structure — a foreign producer need not envelope it", () => {
    expect(unwrapCose(SIGN1, { arity: { exactly: 4 } })).toBe(SIGN1);
  });

  test("refuses a structure whose tag the caller did not ask for", () => {
    // Unwrapping a COSE_Mac0 as a COSE_Sign1 hands a MAC to a signature verifier,
    // which then fails with the wrong diagnosis.
    const mac0 = new Tag(COSE_TAG.mac0, SIGN1);

    expect(
      unwrapCose(mac0, { arity: { exactly: 4 }, tags: [COSE_TAG.sign1] }),
    ).toBeUndefined();
    expect(unwrapCose(mac0, { arity: { exactly: 4 }, tags: [COSE_TAG.mac0] })).toBe(
      SIGN1,
    );
  });

  test("an UNTAGGED structure passes a tag restriction — there is no tag to contradict it", () => {
    expect(unwrapCose(SIGN1, { arity: { exactly: 4 }, tags: [COSE_TAG.sign1] })).toBe(
      SIGN1,
    );
  });

  test("`exactly` refuses a longer or shorter array", () => {
    expect(unwrapCose(ENCRYPT0, { arity: { exactly: 4 } })).toBeUndefined();
    expect(unwrapCose(SIGN1, { arity: { exactly: 3 } })).toBeUndefined();
    expect(unwrapCose(ENCRYPT0, { arity: { exactly: 3 } })).toBe(ENCRYPT0);
  });

  test("`atLeast` admits a longer array", () => {
    expect(unwrapCose(SIGN1, { arity: { atLeast: 2 } })).toBe(SIGN1);
    expect(unwrapCose(ENCRYPT0, { arity: { atLeast: 4 } })).toBeUndefined();
  });

  test("anything that is not an array reads as absent", () => {
    for (const value of [undefined, null, 1, "cose", { 0: "p" }, new Map()]) {
      expect(unwrapCose(value, { arity: { atLeast: 0 } })).toBeUndefined();
    }
  });
});
